const { Collection, Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// URL regex pattern - Güçlendirilmiş sürüm
const URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,}|discord\.gg\/[a-zA-Z0-9-]+)/i;

// Discord davet regex
const DISCORD_INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;

// Collection for cooldowns
const warnedUsers = new Collection();

module.exports = {
    /**
     * Initialize anti-link module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-link module initialized');
        
        // Clean up warned users every 30 minutes
        setInterval(() => {
            const now = Date.now();
            warnedUsers.sweep(timestamp => now - timestamp > 1800000); // 30 minutes
        }, 1800000);
    },
    
    /**
     * Check message for links
     * @param {Message} message 
     * @returns {boolean} Whether links were detected and action was taken
     */
    checkMessage(message) {
        try {
            // Skip if anti-link is disabled
            if (!config.antiLink || !config.antiLink.enabled) return false;
            
            // Ignore bot messages
            if (message.author.bot) return false;
            
            // Log for debugging
            logger.debug(`Anti-link kontrol ediliyor: ${message.content}`);
            
            // Önce Discord davetlerini kontrol et - daha hızlı tespit için
            const discordInvites = message.content.match(DISCORD_INVITE_REGEX);
            if (discordInvites && discordInvites.length > 0) {
                logger.debug(`Discord daveti tespit edildi: ${discordInvites.join(', ')}`);
                
                // Sunucu sahibiyse engelleme
                if (message.guild.ownerId === message.author.id) {
                    logger.debug(`Discord daveti izni var: ${message.author.tag} - Sunucu Sahibi`);
                    return false;
                }
                
                // Botu yöneten kişiyse engelleme
                if (config.owners && config.owners.includes(message.author.id)) {
                    logger.debug(`Discord daveti izni var: ${message.author.tag} - Bot Sahibi`);
                    return false;
                }
                
                logger.security('DISCORD_INVITE', `Discord daveti yakalandı: ${discordInvites[0]} by ${message.author.tag}`);
                this.takeAction(message, config.antiLink.action || 'delete');
                return true;
            }
            
            // Normal linkleri kontrol et
            if (!URL_REGEX.test(message.content)) return false;
            
            logger.debug(`Link tespit edildi: ${message.content}`);
            
            // Ignore users with permission to post links - Kontrol güçlendirildi
            try {
                // Owner her durumda atlanır
                const isOwner = config.owners && config.owners.includes(message.author.id);
                if (isOwner) {
                    logger.debug(`Link izni var: ${message.author.tag} - Bot sahibi`);
                    return false;
                }
                
                // Mod ve Admin rolleri atlanır
                const memberRoles = message.member.roles.cache.map(r => r.id);
                const isModRole = config.modRoles && config.modRoles.some(roleId => memberRoles.includes(roleId));
                const isAdminRole = config.adminRoles && config.adminRoles.some(roleId => memberRoles.includes(roleId));
                
                if (isModRole || isAdminRole) {
                    logger.debug(`Link izni var: ${message.author.tag} - Yetkili Rolü`);
                    return false;
                }
                
                // Sadece sunucu sahibi ve admin rolü olanlar izinli olsun
                // MANAGE_MESSAGES yetkisi varsa ModerationLog sistemi devreye girer fakat, bu kullanıcı hala engellenir
                // Sadece AdminRole, Sunucu Sahibi ve Bot Sahibi atlanır
                
                // Sunucu sahibi kontrolü
                if (message.guild.ownerId === message.author.id) {
                    logger.debug(`Link izni var: ${message.author.tag} - Sunucu Sahibi`);
                    return false;
                }
            } catch (error) {
                logger.error(`Yetkili kontrolü hatası: ${error.message}`);
                // Hata olsa bile devam ediyoruz, yetkili olmayan kullanıcılar için
            }
            
            // Check if the user is whitelisted in the channel
            try {
                const guildConfig = database.getGuildConfig(message.guild.id);
                const allowedChannels = (guildConfig && guildConfig.linkAllowedChannels) || [];
                
                if (allowedChannels.includes(message.channel.id)) {
                    logger.debug(`Link izni var: ${message.channel.name} kanalında linkler serbest`);
                    return false;
                }
            } catch (error) {
                logger.error(`Anti-link channel check error: ${error.message}`);
            }
            
            // Check whitelist
            try {
                const whitelist = config.antiLink.whitelist || [];
                // URL'yi kontrol et
                const matches = message.content.match(URL_REGEX);
                if (matches) {
                    for (const match of matches) {
                        let domain = match;
                        
                        // URL protokolünü ekle eğer yoksa
                        if (!domain.startsWith('http')) {
                            domain = 'http://' + domain;
                        }
                        
                        try {
                            const urlObj = new URL(domain);
                            domain = urlObj.hostname.replace(/^www\./i, '');
                            
                            // Discord davetlerini doğrudan engelle
                            if (domain.includes('discord.gg') || domain.includes('discord.com/invite')) {
                                logger.security('DISCORD_DAVETI', `${message.author.tag} kullanıcısı Discord daveti paylaştı: ${domain}`);
                                this.takeAction(message, config.antiLink.action || 'delete');
                                return true;
                            }
                            
                            // Beyaz listede var mı kontrol et
                            const isWhitelisted = whitelist.some(allowedDomain => 
                                domain.includes(allowedDomain) || allowedDomain.includes(domain)
                            );
                            
                            if (isWhitelisted) {
                                logger.debug(`Beyaz listede: ${domain}`);
                                return false;
                            }
                        } catch (e) {
                            // URL parse edilemezse devam et
                            logger.error(`URL parse hatası: ${e.message} - ${domain}`);
                        }
                    }
                }
            } catch (error) {
                logger.error(`Anti-link whitelist check error: ${error.message}`);
            }
            
            // Check action type
            const action = config.antiLink.action || 'delete';
            logger.security('LINK_ENGELLENDI', `${message.author.tag} tarafından paylaşılan link engellendi: ${message.content.slice(0, 100)}`);
            
            // Take action based on config
            this.takeAction(message, action);
            return true;
        } catch (error) {
            logger.error(`Anti-link genel hata: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Take action against link poster
     * @param {Message} message 
     * @param {string} action - The action to take (delete, warn, mute)
     */
    async takeAction(message, action) {
        logger.security('LINK', `${message.author.tag} tarafından yasak link paylaşıldı`);
        
        try {
            // Delete the message
            await message.delete();
            
            // If this is the first offense in the last 30 minutes, just warn
            if (!warnedUsers.has(message.author.id)) {
                warnedUsers.set(message.author.id, Date.now());
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşmak bu kanalda yasaktır!`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                return;
            }
            
            // For repeated offenses, take the specified action
            if (action === 'warn') {
                // Add warning to database
                const reason = 'Link paylaşımı yasaktır';
                database.addWarning(message.guild.id, message.author.id, message.client.user.id, reason);
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşımından dolayı uyarıldınız!`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                // Send log to log channel
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.warning} Link Uyarısı`)
                            .setDescription(`**${message.author.tag}** link paylaşmaktan dolayı uyarıldı.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Link içeriği', value: `\`\`\`${message.content.slice(0, 900)}\`\`\`` }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            } else if (action === 'mute') {
                // Get mute role
                const muteRole = message.guild.roles.cache.get(config.muteRole) || 
                                message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'susturulmuş');
                
                if (!muteRole) {
                    logger.error('Failed to mute user for link posting: no mute role found');
                    return;
                }
                
                // Get mute duration from config (default: 10 minutes)
                const muteDuration = (config.antiLink.muteDuration || 10) * 60 * 1000;
                
                // Discord.js v13 için timeout özelliğini kullan
                try {
                    // Timeout (zaman aşımı) kullan
                    await message.member.timeout(muteDuration, 'Link paylaşımı yasaktır');
                    logger.info(`${message.author.tag} kullanıcısı link paylaşımı nedeniyle ${config.antiLink.muteDuration || 10} dakika timeout aldı`);
                } catch (timeoutError) {
                    logger.error(`Timeout uygulanırken hata: ${timeoutError.message}`);
                    
                    // Eğer timeout çalışmazsa, klasik mute rol sistemi ile dene
                    await message.member.roles.add(muteRole);
                    logger.info(`${message.author.tag} kullanıcısı link paylaşımı nedeniyle ${config.antiLink.muteDuration || 10} dakika susturuldu (rol ile)`);
                }
                
                // Add mute to database
                database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Link paylaşımı yasaktır', muteDuration);
                
                // Send mute message
                const muteMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.mute} <@${message.author.id}>, link paylaşımından dolayı ${config.antiLink.muteDuration || 10} dakika susturuldunuz!`)
                    ]
                });
                
                // Delete mute message after 5 seconds
                setTimeout(() => {
                    muteMsg.delete().catch(() => {});
                }, 5000);
                
                // Send log to log channel
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.mute} Link Paylaşımı Susturması`)
                            .setDescription(`**${message.author.tag}** link paylaşmaktan dolayı susturuldu.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Süre', value: `${config.antiLink.muteDuration || 10} dakika`, inline: true },
                                { name: 'Link içeriği', value: `\`\`\`${message.content.slice(0, 900)}\`\`\`` }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }
        } catch (error) {
            logger.error(`Anti-link action error: ${error.message}`);
        }
    }
};