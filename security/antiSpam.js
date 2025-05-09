const { Collection, Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// Collection to store user messages
const usersMap = new Collection();

module.exports = {
    /**
     * Initialize anti-spam module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-spam module initialized');
        
        // Check expired timeouts every minute
        setInterval(() => {
            const now = Date.now();
            usersMap.sweep((userData) => now > userData.lastMessage + 30000);
        }, 60000);
    },
    
    /**
     * Check message for spam
     * @param {Message} message 
     * @returns {boolean} Whether spam was detected
     */
    checkMessage(message) {
        try {
            // If anti-spam is disabled, return
            if (!config.antiSpam || !config.antiSpam.enabled) return false;
            
            // Ignore bot messages
            if (message.author.bot) return false;
            
            // GELİŞTİRİLMİŞ SPAM TESPİTİ - Discord.js v13 için optimize edildi
            
            // Get anti-spam config with default values
            const LIMIT = config.antiSpam.maxMessages || 5;
            const TIME_WINDOW = config.antiSpam.timeWindow || 3000;
            
            // İzinler ve rol hiyerarşisi kontrolü
            // Sunucu sahibini kontrol et
            if (message.guild.ownerId === message.author.id) {
                logger.debug(`Spam kontrolü atlandı: ${message.author.tag} (sunucu sahibi)`);
                return false;
            }
            
            // Bot sahibini kontrol et
            if (config.owners.includes(message.author.id)) {
                logger.debug(`Spam kontrolü atlandı: ${message.author.tag} (bot sahibi)`);
                return false;
            }
            
            // Rol hiyerarşisini kontrol et - bottan yüksek rolü olanlar
            if (message.member.roles.highest.position > message.guild.me.roles.highest.position) {
                logger.debug(`Spam kontrolü atlandı: ${message.author.tag} (bot rolünden yüksek)`);
                return false;
            }
            
            // Yönetici iznini kontrol et
            if (message.member.permissions.has('MANAGE_MESSAGES')) {
                logger.debug(`Spam kontrolü atlandı: ${message.author.tag} (yönetici)`);
                return false;
            }
            
            // Şu anki zaman
            const now = Date.now();
            
            // KULLANICININ TÜM VERİLERİNİ KONTROL ET
            const userData = usersMap.get(message.author.id);
            
            // Eğer kullanıcı koleksiyonda yoksa, ekle
            if (!userData) {
                logger.debug(`Yeni kullanıcı spam listesine eklendi: ${message.author.tag}`);
                
                usersMap.set(message.author.id, {
                    messages: 1,
                    lastMessage: now,
                    messagesTimestamps: [now],
                    timer: setTimeout(() => {
                        logger.debug(`Kullanıcı verisi temizlendi: ${message.author.id}`);
                        usersMap.delete(message.author.id);
                    }, TIME_WINDOW)
                });
                
                return false;
            }
            
            // MESAJ SAYISINI KONTROL ETMEK İÇİN YENİ APPROACH:
            // 1. Zaman damgaları listesine şimdiyi ekle 
            // 2. TIME_WINDOW içindeki mesajları filtrele ve say
            // 3. Eğer limit aşılırsa aksiyon al
            
            // Eski timer'ı temizle ve yeni oluştur
            clearTimeout(userData.timer);
            
            // Zaman damgalarını güncelle 
            if (!userData.messagesTimestamps) {
                userData.messagesTimestamps = [now]; // İlk defa oluşturuluyorsa
            } else {
                userData.messagesTimestamps.push(now);
            }
            
            // Sadece son TIME_WINDOW ms içindeki mesajları filtrele
            const recentMessages = userData.messagesTimestamps.filter(
                timestamp => now - timestamp < TIME_WINDOW
            );
            
            // Veriyi güncelle
            userData.messagesTimestamps = recentMessages;
            userData.messages = recentMessages.length;
            userData.lastMessage = now;
            
            // Yeni timer oluştur
            userData.timer = setTimeout(() => {
                logger.debug(`Kullanıcı verisi temizlendi: ${message.author.id}`);
                usersMap.delete(message.author.id);
            }, TIME_WINDOW);
            
            // Spam için limit kontrolü
            if (userData.messages >= LIMIT) {
                logger.info(`SPAM TESPİT EDİLDİ! ${message.author.tag} kullanıcısı ${TIME_WINDOW/1000} saniye içinde ${userData.messages} mesaj gönderdi! Limit: ${LIMIT}`);
                
                // SPAM TESPİT EDİLDİ! AKSİYON AL!
                this.takeAction(message);
                return true;
            }
            
            // Veriyi güncelle
            usersMap.set(message.author.id, userData);
            
            return false;
        } catch (error) {
            logger.error(`Anti-spam kontrol hatası: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Take action against spammer
     * @param {Message} message 
     */
    async takeAction(message) {
        // Log spam detection
        logger.security('SPAM_TESPIT', `${message.author.tag} kullanıcısı spam yapıyor`);
        
        try {
            // Delete recent messages from the user
            const messages = await message.channel.messages.fetch({ limit: 10 });
            const userMessages = messages.filter(m => m.author.id === message.author.id);
            
            if (userMessages.size > 0) {
                message.channel.bulkDelete(userMessages);
            }
            
            // Get mute role
            const muteRole = message.guild.roles.cache.get(config.muteRole) || 
                            message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
            
            // If mute role doesn't exist, try to create it
            if (!muteRole) {
                // Send a warning
                message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}> kullanıcısından spam tespit edildi. Otomatik susturma için lütfen bir susturma rolü yapılandırın.`)
                    ]
                });
                
                return;
            }
            
            // Discord.js v13 için timeout özelliğini kullan
            const muteTime = config.antiSpam.muteTime * 60 * 1000; // Convert minutes to ms
            
            try {
                // Timeout (zaman aşımı) kullan
                await message.member.timeout(muteTime, 'Spam yapma nedeniyle otomatik susturma');
                logger.info(`${message.author.tag} kullanıcısı spam nedeniyle ${config.antiSpam.muteTime} dakika timeout aldı`);
            } catch (timeoutError) {
                logger.error(`Timeout uygulanırken hata: ${timeoutError.message}`);
                
                // Eğer timeout çalışmazsa, klasik mute rol sistemi ile dene
                await message.member.roles.add(muteRole);
                logger.info(`${message.author.tag} kullanıcısı spam nedeniyle ${config.antiSpam.muteTime} dakika susturuldu (rol ile)`);
            }
            
            // Add mute to database with duration
            database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Spam yapma nedeniyle otomatik susturma', muteTime);
            
            // Send notification in channel
            message.channel.send({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.warning)
                    .setDescription(`${config.emojis.mute} <@${message.author.id}> spam yaptığı için ${config.antiSpam.muteTime} dakika susturuldu.`)
                ]
            });
            
            // Send DM to user
            try {
                await message.author.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} ${message.guild.name} sunucusunda susturuldunuz`)
                        .setDescription(`Spam yaptığınız için ${config.antiSpam.muteTime} dakika otomatik olarak susturuldunuz.`)
                        .setFooter({ text: 'Lütfen sunucu kurallarına saygı gösterin ve gelecekte spam yapmaktan kaçının.' })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Ignore if user has DMs closed
            }
            
            // Send log to log channel
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} Spam için Otomatik Susturma`)
                        .setDescription(`**${message.author.tag}** spam yaptığı için otomatik olarak susturuldu.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Kullanıcı ID', value: message.author.id, inline: true },
                            { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Süre', value: `${config.antiSpam.muteTime} dakika`, inline: true }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
            
            // Reset user in usersMap
            usersMap.delete(message.author.id);
            
        } catch (error) {
            logger.error(`Anti-spam action error: ${error.message}`);
        }
    }
};
