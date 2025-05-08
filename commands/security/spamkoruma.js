const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'spamkoruma',
    description: 'Spam koruma sistemini kontrol eder',
    usage: '[aç/kapat] [süre/mesaj/ceza] [değer]',
    aliases: ['antispam', 'spam-koruma', 'spam-protection', 'spamfiltre'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.ADMINISTRATOR],
    botPermissions: [Permissions.FLAGS.ADMINISTRATOR],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        try {
            // Mevcut ayarları al
            const settings = config.antiSpam;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.warning} Spam Koruma Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Max Mesaj Sayısı', value: `${settings.maxMessages}`, inline: true },
                            { name: 'Zaman Aralığı', value: `${settings.timeWindow/1000} saniye`, inline: true },
                            { name: 'Susturma Süresi', value: `${settings.muteTime} dakika`, inline: true }
                        )
                        .setDescription(`Spam koruma sistemi, kısa sürede çok fazla mesaj gönderen kullanıcıları tespit eder ve susturur.`)
                        .setFooter({ text: `${config.prefix}spamkoruma [aç/kapat] [süre/mesaj/ceza] [değer]` })
                    ]
                });
            }
            
            // Komut argümanlarını kontrol et
            const action = args[0].toLowerCase();
            
            // aç/kapat işlemleri
            if (action === 'aç' || action === 'açık' || action === 'on' || action === 'enable') {
                if (settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Spam koruma sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiSpam.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Spam koruma sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Spam koruma sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiSpam.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Spam koruma sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Mesaj sayısı ayarlama
            else if (action === 'mesaj' || action === 'message' || action === 'max') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen maksimum mesaj sayısını belirtin!`)
                        ]
                    });
                }
                
                const maxMessages = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(maxMessages) || maxMessages < 3 || maxMessages > 20) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz mesaj sayısı! Lütfen 3-20 arasında bir değer girin.`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiSpam.maxMessages = maxMessages;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Maksimum mesaj sayısı başarıyla **${maxMessages}** olarak ayarlandı!`)
                    ]
                });
            }
            // Zaman aralığı ayarlama
            else if (action === 'zaman' || action === 'süre' || action === 'time' || action === 'window') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen zaman aralığını saniye cinsinden belirtin!`)
                        ]
                    });
                }
                
                const seconds = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(seconds) || seconds < 1 || seconds > 30) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz zaman aralığı! Lütfen 1-30 arasında bir değer girin (saniye).`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiSpam.timeWindow = seconds * 1000;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Zaman aralığı başarıyla **${seconds} saniye** olarak ayarlandı!`)
                    ]
                });
            }
            // Mute süresini ayarlama
            else if (action === 'ceza' || action === 'punishment' || action === 'mute' || action === 'susturma') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen susturma süresini dakika cinsinden belirtin!`)
                        ]
                    });
                }
                
                const minutes = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz susturma süresi! Lütfen 1-1440 arasında bir değer girin (dakika).`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiSpam.muteTime = minutes;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Susturma süresi başarıyla **${minutes} dakika** olarak ayarlandı!`)
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}spamkoruma [aç/kapat/mesaj/zaman/ceza] [değer]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Spam koruma komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};