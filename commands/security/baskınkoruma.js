const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'baskınkoruma',
    description: 'Sunucuya çok sayıda üye katılımını tespit eden baskın koruma sistemini kontrol eder',
    usage: '[aç/kapat] [eşik/süre/eylem] [değer]',
    aliases: ['raid-koruma', 'antiraid', 'raidkoruma', 'baskin', 'ani-katilim'],
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
            const settings = config.antiRaid;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.shield} Baskın Koruma Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Katılım Eşiği', value: `${settings.joinThreshold} üye`, inline: true },
                            { name: 'Zaman Aralığı', value: `${settings.timeWindow/1000} saniye`, inline: true },
                            { name: 'Eylem', value: settings.action === 'lockdown' ? '🔒 Sunucuyu Kilitle' : 
                                               settings.action === 'kick' ? '👢 Yeni Üyeleri At' : 
                                               settings.action === 'ban' ? '🔨 Yeni Üyeleri Yasakla' : 
                                               '❌ Yeni Üyeleri Engelle', inline: true }
                        )
                        .setDescription(`Baskın koruma sistemi, kısa sürede çok fazla üye katılımı tespit edildiğinde sunucuyu korur.`)
                        .setFooter({ text: `${config.prefix}baskınkoruma [aç/kapat] [eşik/süre/eylem] [değer]` })
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
                            .setDescription(`${config.emojis.warning} Baskın koruma sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiRaid.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Baskın koruma sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Baskın koruma sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiRaid.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Baskın koruma sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Eşik değeri ayarlama
            else if (action === 'eşik' || action === 'esik' || action === 'threshold' || action === 'limit') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen katılım eşiği sayısını belirtin!`)
                        ]
                    });
                }
                
                const threshold = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(threshold) || threshold < 3 || threshold > 50) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz eşik değeri! Lütfen 3-50 arasında bir değer girin.`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiRaid.joinThreshold = threshold;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Katılım eşiği başarıyla **${threshold} üye** olarak ayarlandı!`)
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
                if (isNaN(seconds) || seconds < 1 || seconds > 60) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz zaman aralığı! Lütfen 1-60 arasında bir değer girin (saniye).`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiRaid.timeWindow = seconds * 1000;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Zaman aralığı başarıyla **${seconds} saniye** olarak ayarlandı!`)
                    ]
                });
            }
            // Eylem ayarlama
            else if (action === 'eylem' || action === 'action' || action === 'ceza' || action === 'işlem') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen baskın tespit edildiğinde uygulanacak eylemi belirtin! (kilit/at/yasakla/engelle)`)
                        ]
                    });
                }
                
                const actionType = args[1].toLowerCase();
                
                if (actionType === 'kilit' || actionType === 'kilitle' || actionType === 'lockdown' || actionType === 'lock') {
                    config.antiRaid.action = 'lockdown';
                }
                else if (actionType === 'at' || actionType === 'kick') {
                    config.antiRaid.action = 'kick';
                }
                else if (actionType === 'yasakla' || actionType === 'ban') {
                    config.antiRaid.action = 'ban';
                }
                else if (actionType === 'engelle' || actionType === 'block') {
                    config.antiRaid.action = 'block';
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz eylem türü! Lütfen 'kilit', 'at', 'yasakla' veya 'engelle' olarak belirtin.`)
                        ]
                    });
                }
                
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Baskın eylem türü başarıyla **${config.antiRaid.action}** olarak ayarlandı!`)
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}baskınkoruma [aç/kapat/eşik/süre/eylem] [değer]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Baskın koruma komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};