const { Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');
const emojiRegex = require('emoji-regex');

// Süreli uyarılmış kullanıcıları takip etmek için Map
const warnedUsers = new Map();

module.exports = {
    /**
     * Initialize emoji filter module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Emoji filtresi modülü başlatıldı');
        
        // 30 dakikada bir uyarı geçmişini temizle
        setInterval(() => {
            const now = Date.now();
            warnedUsers.forEach((timestamp, userId) => {
                if (now - timestamp > 30 * 60 * 1000) { // 30 dakika
                    warnedUsers.delete(userId);
                }
            });
        }, 60 * 1000); // Her dakika kontrol et
        
        // Config yoksa oluştur
        if (!config.emojiFilter) {
            config.emojiFilter = {
                enabled: false,
                maxEmojis: 5,
                action: 'delete' // delete, warn, mute
            };
        }
    },
    
    /**
     * Check message for excessive emoji usage
     * @param {Message} message 
     * @returns {boolean} Whether excessive emoji was detected
     */
    checkMessage(message) {
        // Filtre devre dışıysa kontrol etme
        if (!config.emojiFilter?.enabled) return false;
        
        // Bot mesajlarını kontrol etme
        if (message.author.bot) return false;
        
        // DM'leri kontrol etme
        if (!message.guild) return false;
        
        // Admine dokunma
        if (message.member.permissions.has('ADMINISTRATOR')) return false;
        
        try {
            // Mesajdaki emoji sayısını say
            const regex = emojiRegex();
            const content = message.content;
            const matches = content.match(regex) || [];
            const emojiCount = matches.length;
            
            // Emoji limiti aşılmış mı?
            if (emojiCount > config.emojiFilter.maxEmojis) {
                // Fazla emoji kullanımı, işlem yap
                logger.security('EMOJI_LIMIT', `${message.author.tag} emoji limitini aştı: ${emojiCount} emoji`);
                
                // Belirlenen eylemi uygula
                this.takeAction(message, config.emojiFilter.action || 'delete', emojiCount);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Emoji filtresi hatası: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Take action against excessive emoji usage
     * @param {Message} message 
     * @param {string} action - The action to take (delete, warn, mute)
     * @param {number} emojiCount - Number of emojis detected
     */
    async takeAction(message, action, emojiCount) {
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
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, lütfen fazla emoji kullanmayın (${emojiCount}/${config.emojiFilter.maxEmojis}).`)
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
                const reason = 'Aşırı emoji kullanımı';
                database.addWarning(message.guild.id, message.author.id, message.client.user.id, reason);
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, aşırı emoji kullanımından dolayı uyarıldınız!`)
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
                            .setTitle(`${config.emojis.warning} Emoji Uyarısı`)
                            .setDescription(`**${message.author.tag}** aşırı emoji kullanmaktan dolayı uyarıldı.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Emoji Sayısı', value: `${emojiCount}/${config.emojiFilter.maxEmojis}`, inline: true }
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
                    logger.error('Aşırı emoji kullanımı için kullanıcı susturulamadı: susturma rolü bulunamadı');
                    return;
                }
                
                // Add mute role
                await message.member.roles.add(muteRole);
                
                // Get mute duration from config (default: 10 minutes)
                const muteDuration = (config.emojiFilter.muteDuration || 10) * 60 * 1000;
                
                // Add mute to database
                database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Aşırı emoji kullanımı', muteDuration);
                
                // Send mute message
                const muteMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.mute} <@${message.author.id}>, aşırı emoji kullanımından dolayı ${config.emojiFilter.muteDuration || 10} dakika susturuldunuz!`)
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
                            .setTitle(`${config.emojis.mute} Emoji Limit Aşımı Susturması`)
                            .setDescription(`**${message.author.tag}** aşırı emoji kullanmaktan dolayı susturuldu.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Süre', value: `${config.emojiFilter.muteDuration || 10} dakika`, inline: true },
                                { name: 'Emoji Sayısı', value: `${emojiCount}/${config.emojiFilter.maxEmojis}`, inline: true }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }
        } catch (error) {
            logger.error(`Emoji filtresi eylem hatası: ${error.message}`);
        }
    }
};