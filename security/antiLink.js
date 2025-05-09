const { Collection, Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// URL regex pattern - Güçlendirilmiş sürüm
const URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,}|discord\.gg\/[a-zA-Z0-9-]+)/i;

// Discord davet regex
const DISCORD_INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/gi;

// Collection for warned users - gelişmiş uyarı sayacı için
const warnedUsers = new Collection();

// Link uyarı bilgilerini güncelleyen zamanlayıcı
// Her 30 dakikada bir, eski uyarıları temizle
setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 30 * 60 * 1000; // 30 dakika
    
    let temizlenen = 0;
    
    // Her kullanıcı için eski uyarıları temizle
    warnedUsers.forEach((userData, userId) => {
        // Son uyarıdan bu yana 30 dakika geçtiyse, sayacı sıfırla
        if (now - userData.lastWarning > TIMEOUT) {
            warnedUsers.delete(userId);
            temizlenen++;
        } else if (userData.warningTimestamps) {
            // Eski uyarıları temizle
            const eskiUzunluk = userData.warningTimestamps.length;
            userData.warningTimestamps = userData.warningTimestamps.filter(time => now - time < TIMEOUT);
            const yeniUzunluk = userData.warningTimestamps.length;
            
            if (eskiUzunluk !== yeniUzunluk) {
                userData.count = userData.warningTimestamps.length;
                warnedUsers.set(userId, userData);
                temizlenen++;
            }
        }
    });
    
    if (temizlenen > 0) {
        logger.debug(`Link uyarı sayaçları temizlendi: ${temizlenen} kullanıcı`);
    }
}, 5 * 60 * 1000); // 5 dakikada bir kontrol et

module.exports = {
    /**
     * Initialize anti-link module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-link module initialized');
    },
    
    /**
     * Check message for links
     * @param {Message} message 
     * @returns {boolean} Whether links were detected and action was taken
     */
    checkMessage(message) {
        try {
            // Sunucu yapılandırmasını al
            const guildConfig = database.getGuildConfig(message.guild.id);
            
            // Skip if anti-link is disabled or guild config doesn't exist
            if (!guildConfig || !guildConfig.antiLink || !guildConfig.antiLink.enabled) return false;
            
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
                
                logger.security('DISCORD_INVITE', `Discord daveti yakalandı: ${discordInvites[0]} by ${message.author.tag} in ${message.guild.name}`);
                this.takeAction(message, guildConfig.antiLink.action || 'delete');
                return true;
            }
            
            // Normal linkleri kontrol et
            const hasLink = URL_REGEX.test(message.content);
            if (!hasLink) {
                logger.debug(`Link tespit edilmedi: ${message.content}`);
                return false;
            }
            
            logger.debug(`Link tespit edildi: ${message.content}`);
            logger.info(`${message.author.tag} kullanıcısından link algılandı: ${message.content.substring(0, 25)}`);
            
            // DEV: Link testi için özel mesaj
            console.log(`LİNK TESPİT EDİLDİ: ${message.content.substring(0, 25)}...`);
            
            // Ignore users with permission to post links - Kontrol güçlendirildi
            try {
                // Sunucu sahibi her durumda atlanır
                if (message.guild.ownerId === message.author.id) {
                    logger.debug(`Link izni var: ${message.author.tag} - Sunucu Sahibi`);
                    return false;
                }
                
                // Bot sahibi her durumda atlanır
                const isOwner = config.owners && config.owners.includes(message.author.id);
                if (isOwner) {
                    logger.debug(`Link izni var: ${message.author.tag} - Bot sahibi`);
                    return false;
                }
                
                // Rol hiyerarşisini kontrol et - bottan yüksek rolü olanlar
                if (message.member.roles.highest.position > message.guild.me.roles.highest.position) {
                    logger.debug(`Link izni var: ${message.author.tag} - Bot rolünden yüksek rolü var`);
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
                
                // Yönetici izni olanları atla
                if (message.member.permissions.has('ADMINISTRATOR')) {
                    logger.debug(`Link izni var: ${message.author.tag} - Yönetici izni var`);
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
                const whitelist = (guildConfig && guildConfig.antiLink && guildConfig.antiLink.whitelist) || [];
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
                                logger.security('DISCORD_DAVETI', `${message.author.tag} kullanıcısı Discord daveti paylaştı: ${domain} in ${message.guild.name}`);
                                this.takeAction(message, guildConfig.antiLink.action || 'delete');
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
            const action = (guildConfig && guildConfig.antiLink && guildConfig.antiLink.action) || 'delete';
            logger.security('LINK_ENGELLENDI', `${message.author.tag} tarafından paylaşılan link engellendi: ${message.content.slice(0, 100)} in ${message.guild.name}`);
            
            // Take action based on guild config
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
        logger.security('LINK', `${message.author.tag} tarafından yasak link paylaşıldı - ${message.guild.name}`);
        
        try {
            // Delete the message
            await message.delete();
            
            // Sunucu yapılandırmasını al
            const guildConfig = database.getGuildConfig(message.guild.id);
            if (!guildConfig) return;  // Yapılandırma yoksa işlemi sonlandır
            
            // Link uyarı sayısı yönetimi - 3 kez tekrarlanırsa ceza uygulanır
            // Kullanıcı daha önce uyarılmışsa uyarı sayısını artır, yoksa 1 olarak başlat
            
            const MAX_WARNINGS = (guildConfig.antiLink && guildConfig.antiLink.maxWarnings) || 3; // En fazla uyarı sayısı (3. uyarıdan sonra mute)
            const uyariSuresi = 30 * 60 * 1000; // 30 dakika içindeki uyarıları say
            const now = Date.now();
            
            // Kullanıcının uyarı verilerini al
            let userData = warnedUsers.get(message.author.id);
            
            if (!userData) {
                // İlk kez uyarı alıyorsa
                userData = {
                    count: 1,
                    lastWarning: now,
                    warningTimestamps: [now]
                };
                
                warnedUsers.set(message.author.id, userData);
                
                // İlk uyarı mesajı
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşmak bu kanalda yasaktır! (Uyarı: 1/${MAX_WARNINGS})`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                return;
            }
            
            // Eski uyarıları temizle (30 dk'dan eski olanları)
            userData.warningTimestamps = userData.warningTimestamps.filter(time => now - time < uyariSuresi);
            
            // Yeni uyarıyı ekle
            userData.warningTimestamps.push(now);
            userData.lastWarning = now;
            userData.count = userData.warningTimestamps.length;
            
            // Uyarı sayısını güncelle
            warnedUsers.set(message.author.id, userData);
            
            logger.info(`${message.author.tag} link paylaşım uyarı sayısı: ${userData.count}/${MAX_WARNINGS}`);
            
            // Uyarı limitini (3) aşarsa, aksiyon uygula
            if (userData.count >= MAX_WARNINGS) {
                // Mute işlemi yap, ne olursa olsun
                action = 'mute';
                // Uyarı sayacını sıfırla
                userData.count = 0;
                userData.warningTimestamps = [];
                warnedUsers.set(message.author.id, userData);
                
                logger.security('LINK_MUTE', `${message.author.tag} kullanıcısı ${MAX_WARNINGS} kez link paylaşımı yaptığı için susturuldu`);
            } else {
                // Sadece uyarı mesajı gönder ve dön
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşmak bu kanalda yasaktır! (Uyarı: ${userData.count}/${MAX_WARNINGS})`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                // Uyarı sayısı limitin altındaysa (1, 2 gibi) ve işlem sadece uyarı/silme ise, burada dön
                if (action !== 'mute') {
                    return;
                }
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
                const logChannel = message.guild.channels.cache.get(guildConfig.logChannel);
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
                // Get mute role from guild config
                const muteRole = message.guild.roles.cache.get(guildConfig.muteRole) || 
                                message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'susturulmuş');
                
                if (!muteRole) {
                    logger.error(`Failed to mute user ${message.author.tag} for link posting in ${message.guild.name}: no mute role found`);
                    return;
                }
                
                // Get mute duration from guild config (default: 10 minutes)
                const muteDuration = (guildConfig.antiLink && guildConfig.antiLink.muteDuration || 10) * 60 * 1000;
                
                // Discord.js v13 için timeout özelliğini kullan
                try {
                    // Timeout (zaman aşımı) kullan
                    await message.member.timeout(muteDuration, 'Link paylaşımı yasaktır');
                    logger.info(`${message.author.tag} kullanıcısı link paylaşımı nedeniyle ${guildConfig.antiLink.muteDuration || 10} dakika timeout aldı`);
                } catch (timeoutError) {
                    logger.error(`Timeout uygulanırken hata: ${timeoutError.message}`);
                    
                    // Eğer timeout çalışmazsa, klasik mute rol sistemi ile dene
                    await message.member.roles.add(muteRole);
                    logger.info(`${message.author.tag} kullanıcısı link paylaşımı nedeniyle ${guildConfig.antiLink.muteDuration || 10} dakika susturuldu (rol ile)`);
                }
                
                // Add mute to database
                database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Link paylaşımı yasaktır', muteDuration);
                
                // Send mute message
                const muteMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.mute} <@${message.author.id}>, link paylaşımından dolayı ${guildConfig.antiLink && guildConfig.antiLink.muteDuration || 10} dakika susturuldunuz!`)
                    ]
                });
                
                // Delete mute message after 5 seconds
                setTimeout(() => {
                    muteMsg.delete().catch(() => {});
                }, 5000);
                
                // Send log to log channel
                const logChannel = message.guild.channels.cache.get(guildConfig.logChannel);
                if (logChannel) {
                    logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.mute} Link Paylaşımı Susturması`)
                            .setDescription(`**${message.author.tag}** link paylaşmaktan dolayı susturuldu.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Süre', value: `${guildConfig.antiLink && guildConfig.antiLink.muteDuration || 10} dakika`, inline: true },
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