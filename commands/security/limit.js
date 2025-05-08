const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'limit',
    description: 'Sunucudaki çeşitli işlemler için limit ayarlarını kontrol eder',
    usage: '[aç/kapat/kanal/rol/kick/ban/etiket] [sayı]',
    aliases: ['limiter', 'limits', 'sınır', 'koruma'],
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
            const settings = config.limits;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.shield} Limit Sistemi Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Limit Aşıldığında', value: settings.action === 'kick' ? '👢 Atılır' : 
                                                       settings.action === 'ban' ? '🔨 Yasaklanır' : 
                                                       '👥 Rolleri Alınır', inline: true },
                            { name: 'Zaman Aralığı', value: `${settings.timeWindow/1000} saniye`, inline: true },
                            { name: '\u200B', value: '\u200B', inline: false },
                            { name: `${config.emojis.channel} Kanal Oluşturma`, value: `${settings.channelCreate}`, inline: true },
                            { name: `${config.emojis.channel} Kanal Silme`, value: `${settings.channelDelete}`, inline: true },
                            { name: `${config.emojis.role} Rol Oluşturma`, value: `${settings.roleCreate}`, inline: true },
                            { name: `${config.emojis.role} Rol Silme`, value: `${settings.roleDelete}`, inline: true },
                            { name: `${config.emojis.kick} Atma Limiti`, value: `${settings.kick}`, inline: true },
                            { name: `${config.emojis.ban} Yasaklama Limiti`, value: `${settings.ban}`, inline: true },
                            { name: `${config.emojis.info} Toplu Etiket`, value: `${settings.massTag}`, inline: true },
                        )
                        .setDescription(`Limit koruma sistemi, kısa sürede çok fazla işlem yapılmasını engeller.`)
                        .setFooter({ text: `${config.prefix}limit [aç/kapat/kanal/rol/kick/ban/etiket] [sayı]` })
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
                            .setDescription(`${config.emojis.warning} Limit sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.limits.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Limit sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Limit sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.limits.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Limit sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Limit değerlerini ayarla
            else if (action === 'kanal' || action === 'channel') {
                if (args.length < 3) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen işlem türünü (oluşturma/silme) ve limit sayısını belirtin!`)
                        ]
                    });
                }
                
                const type = args[1].toLowerCase();
                const limit = parseInt(args[2]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(limit) || limit < 1 || limit > 20) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz limit! Lütfen 1-20 arasında bir değer girin.`)
                        ]
                    });
                }
                
                if (type === 'oluşturma' || type === 'create' || type === 'oluştur') {
                    config.limits.channelCreate = limit;
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} Kanal oluşturma limiti başarıyla **${limit}** olarak ayarlandı!`)
                        ]
                    });
                }
                else if (type === 'silme' || type === 'delete' || type === 'sil') {
                    config.limits.channelDelete = limit;
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} Kanal silme limiti başarıyla **${limit}** olarak ayarlandı!`)
                        ]
                    });
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz kanal işlemi! Lütfen 'oluşturma' veya 'silme' olarak belirtin.`)
                        ]
                    });
                }
            }
            else if (action === 'rol' || action === 'role') {
                if (args.length < 3) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen işlem türünü (oluşturma/silme) ve limit sayısını belirtin!`)
                        ]
                    });
                }
                
                const type = args[1].toLowerCase();
                const limit = parseInt(args[2]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(limit) || limit < 1 || limit > 20) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz limit! Lütfen 1-20 arasında bir değer girin.`)
                        ]
                    });
                }
                
                if (type === 'oluşturma' || type === 'create' || type === 'oluştur') {
                    config.limits.roleCreate = limit;
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} Rol oluşturma limiti başarıyla **${limit}** olarak ayarlandı!`)
                        ]
                    });
                }
                else if (type === 'silme' || type === 'delete' || type === 'sil') {
                    config.limits.roleDelete = limit;
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} Rol silme limiti başarıyla **${limit}** olarak ayarlandı!`)
                        ]
                    });
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz rol işlemi! Lütfen 'oluşturma' veya 'silme' olarak belirtin.`)
                        ]
                    });
                }
            }
            else if (action === 'kick' || action === 'at' || action === 'atma') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen limit sayısını belirtin!`)
                        ]
                    });
                }
                
                const limit = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(limit) || limit < 1 || limit > 20) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz limit! Lütfen 1-20 arasında bir değer girin.`)
                        ]
                    });
                }
                
                config.limits.kick = limit;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Atma limiti başarıyla **${limit}** olarak ayarlandı!`)
                    ]
                });
            }
            else if (action === 'ban' || action === 'yasakla' || action === 'yasaklama') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen limit sayısını belirtin!`)
                        ]
                    });
                }
                
                const limit = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(limit) || limit < 1 || limit > 20) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz limit! Lütfen 1-20 arasında bir değer girin.`)
                        ]
                    });
                }
                
                config.limits.ban = limit;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Yasaklama limiti başarıyla **${limit}** olarak ayarlandı!`)
                    ]
                });
            }
            else if (action === 'etiket' || action === 'tag' || action === 'mention') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen limit sayısını belirtin!`)
                        ]
                    });
                }
                
                const limit = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(limit) || limit < 1 || limit > 50) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz limit! Lütfen 1-50 arasında bir değer girin.`)
                        ]
                    });
                }
                
                config.limits.massTag = limit;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Toplu etiket limiti başarıyla **${limit}** olarak ayarlandı!`)
                    ]
                });
            }
            else if (action === 'eylem' || action === 'işlem' || action === 'ceza' || action === 'action') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen limit aşıldığında uygulanacak eylemi belirtin! (kick/ban/rol)`)
                        ]
                    });
                }
                
                const actionType = args[1].toLowerCase();
                
                if (actionType === 'kick' || actionType === 'at') {
                    config.limits.action = 'kick';
                }
                else if (actionType === 'ban' || actionType === 'yasakla') {
                    config.limits.action = 'ban';
                }
                else if (actionType === 'rol' || actionType === 'role' || actionType === 'remove_roles') {
                    config.limits.action = 'remove_roles';
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz eylem türü! Lütfen 'kick', 'ban' veya 'rol' olarak belirtin.`)
                        ]
                    });
                }
                
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Limit aşıldığında uygulanacak eylem başarıyla **${config.limits.action}** olarak ayarlandı!`)
                    ]
                });
            }
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
                            .setDescription(`${config.emojis.error} Geçersiz zaman! Lütfen 1-60 arasında bir değer girin (saniye).`)
                        ]
                    });
                }
                
                config.limits.timeWindow = seconds * 1000;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Zaman aralığı başarıyla **${seconds} saniye** olarak ayarlandı!`)
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}limit [aç/kapat/kanal/rol/kick/ban/etiket/eylem/zaman] [değer]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Limit komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};