const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'urlkoruma',
    description: 'Sunucunun özel URL\'sini koruyan sistemi kontrol eder',
    usage: '[aç/kapat] [ceza]',
    aliases: ['vanity-protection', 'url-guard', 'urlguard', 'url-koruma', 'vanity'],
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
            const settings = config.vanityUrlProtection;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.link} URL Koruma Sistemi Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Ceza Türü', value: settings.action === 'kick' ? '👢 Atılır' : 
                                               settings.action === 'ban' ? '🔨 Yasaklanır' : 
                                               '👥 Rolleri Alınır', inline: true }
                        )
                        .setDescription(`URL koruma sistemi, sunucunun özel URL'sinin değiştirilmesini engeller.`)
                        .setFooter({ text: `${config.prefix}urlkoruma [aç/kapat] [ceza]` })
                    ]
                });
            }
            
            // Partner programına dahil olmayan sunucular için uyarı
            const vanityFeature = message.guild.features.includes('VANITY_URL');
            if (!vanityFeature) {
                message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} **Dikkat:** Bu sunucu özel URL özelliğine sahip değil. Bu komut sadece Discord Partner veya Seviye 3 Nitro Boost sunucularında tam olarak çalışır.`)
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
                            .setDescription(`${config.emojis.warning} URL koruma sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.vanityUrlProtection.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} URL koruma sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} URL koruma sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.vanityUrlProtection.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} URL koruma sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Ceza türü ayarlama
            else if (action === 'ceza' || action === 'punishment' || action === 'action') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen ceza türünü belirtin! (kick/ban/rol)`)
                        ]
                    });
                }
                
                const actionType = args[1].toLowerCase();
                
                if (actionType === 'kick' || actionType === 'at') {
                    config.vanityUrlProtection.action = 'kick';
                }
                else if (actionType === 'ban' || actionType === 'yasakla') {
                    config.vanityUrlProtection.action = 'ban';
                }
                else if (actionType === 'rol' || actionType === 'role' || actionType === 'remove_roles') {
                    config.vanityUrlProtection.action = 'remove_roles';
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz ceza türü! Lütfen 'kick', 'ban' veya 'rol' olarak belirtin.`)
                        ]
                    });
                }
                
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} URL koruma cezası başarıyla **${config.vanityUrlProtection.action}** olarak ayarlandı!`)
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}urlkoruma [aç/kapat/ceza] [ceza türü]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`URL koruma komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};