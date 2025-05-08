const { Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// Süreli susturulmuş kullanıcıları takip etmek için Map
const warnedUsers = new Map();

module.exports = {
    /**
     * Initialize word filter module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Kelime filtresi modülü başlatıldı');
        
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
        if (!config.wordFilter) {
            config.wordFilter = {
                enabled: false,
                words: [],
                action: 'delete' // delete, warn, mute
            };
        }
    },
    
    /**
     * Check message for banned words
     * @param {Message} message 
     * @returns {boolean} Whether banned words were detected
     */
    checkMessage(message) {
        // Filtre devre dışıysa kontrol etme
        if (!config.wordFilter?.enabled) return false;
        
        // Yasaklı kelime yoksa kontrol etme
        if (!config.wordFilter.words?.length) return false;
        
        // Bot mesajlarını kontrol etme
        if (message.author.bot) return false;
        
        // DM'leri kontrol etme
        if (!message.guild) return false;
        
        // Admine dokunma
        if (message.member.permissions.has('ADMINISTRATOR')) return false;
        
        try {
            // Mesajı kontrol et
            const content = message.content.toLowerCase();
            
            // Yasaklı kelime var mı kontrol et
            const foundWord = config.wordFilter.words.find(word => 
                content.includes(word.toLowerCase())
            );
            
            if (foundWord) {
                // Yasaklı kelime bulundu, işlem yap
                logger.security('YASAK_KELIME', `${message.author.tag} yasaklı kelime kullandı: ${foundWord}`);
                
                // Belirlenen eylemi uygula
                this.takeAction(message, config.wordFilter.action || 'delete', foundWord);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Kelime filtresi hatası: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Take action against banned word usage
     * @param {Message} message 
     * @param {string} action - The action to take (delete, warn, mute)
     * @param {string} word - The banned word that was detected
     */
    async takeAction(message, action, word) {
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
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, yasaklı kelime kullanımı tespit edildi. Lütfen uygun bir dil kullanın.`)
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
                const reason = 'Yasaklı kelime kullanımı';
                database.addWarning(message.guild.id, message.author.id, message.client.user.id, reason);
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, yasaklı kelime kullanımından dolayı uyarıldınız!`)
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
                            .setTitle(`${config.emojis.warning} Yasaklı Kelime Uyarısı`)
                            .setDescription(`**${message.author.tag}** yasaklı kelime kullanmaktan dolayı uyarıldı.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Yasaklı Kelime', value: `|| ${word} ||`, inline: true }
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
                    logger.error('Yasaklı kelime için kullanıcı susturulamadı: susturma rolü bulunamadı');
                    return;
                }
                
                // Add mute role
                await message.member.roles.add(muteRole);
                
                // Get mute duration from config (default: 10 minutes)
                const muteDuration = (config.wordFilter.muteDuration || 10) * 60 * 1000;
                
                // Add mute to database
                database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Yasaklı kelime kullanımı', muteDuration);
                
                // Send mute message
                const muteMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.mute} <@${message.author.id}>, yasaklı kelime kullanımından dolayı ${config.wordFilter.muteDuration || 10} dakika susturuldunuz!`)
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
                            .setTitle(`${config.emojis.mute} Yasaklı Kelime Susturması`)
                            .setDescription(`**${message.author.tag}** yasaklı kelime kullanmaktan dolayı susturuldu.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Süre', value: `${config.wordFilter.muteDuration || 10} dakika`, inline: true },
                                { name: 'Yasaklı Kelime', value: `|| ${word} ||`, inline: true }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }
        } catch (error) {
            logger.error(`Kelime filtresi eylem hatası: ${error.message}`);
        }
    }
};