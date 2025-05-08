const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'botfiltre',
    description: 'Sunucuya eklenen botları filtreleme sistemini kontrol eder',
    usage: '[aç/kapat] [botid]',
    aliases: ['botfilter', 'antibots', 'botkoruma', 'bot-koruma'],
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
            const settings = config.antiBots;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.bot} Bot Filtresi Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Beyaz Liste Bot Sayısı', value: `${settings.whitelistedBots.length}`, inline: true }
                        )
                        .setDescription(`Bot filtresi, izin verilmeyen botların sunucuya eklenmesini engeller.`)
                        .setFooter({ text: `${config.prefix}botfiltre [aç/kapat] [botid]` })
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
                            .setDescription(`${config.emojis.warning} Bot filtresi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiBots.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Bot filtresi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Bot filtresi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiBots.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Bot filtresi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Botları beyaz listeye ekle/çıkar
            else if (action === 'ekle' || action === 'add' || action === 'whitelist') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen eklemek istediğiniz botun ID'sini belirtin!`)
                        ]
                    });
                }
                
                const botId = args[1];
                
                // Geçerli bir snowflake ID mi kontrol et
                if (!/^\d{17,19}$/.test(botId)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz bot ID'si! Discord ID'leri 17-19 basamaklı sayılardır.`)
                        ]
                    });
                }
                
                // Zaten beyaz listede mi kontrol et
                if (settings.whitelistedBots.includes(botId)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Bu bot zaten beyaz listede!`)
                        ]
                    });
                }
                
                // Beyaz listeye ekle ve kaydet
                config.antiBots.whitelistedBots.push(botId);
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Bot ID \`${botId}\` başarıyla beyaz listeye eklendi!`)
                    ]
                });
            }
            else if (action === 'çıkar' || action === 'kaldır' || action === 'remove' || action === 'delete') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen çıkarmak istediğiniz botun ID'sini belirtin!`)
                        ]
                    });
                }
                
                const botId = args[1];
                
                // Beyaz listede mi kontrol et
                if (!settings.whitelistedBots.includes(botId)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Bu bot beyaz listede değil!`)
                        ]
                    });
                }
                
                // Beyaz listeden çıkar ve kaydet
                config.antiBots.whitelistedBots = config.antiBots.whitelistedBots.filter(id => id !== botId);
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Bot ID \`${botId}\` başarıyla beyaz listeden çıkarıldı!`)
                    ]
                });
            }
            else if (action === 'liste' || action === 'list') {
                if (settings.whitelistedBots.length === 0) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.info)
                            .setDescription(`${config.emojis.info} Beyaz listede hiç bot bulunmuyor.`)
                        ]
                    });
                }
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.bot} Beyaz Listedeki Botlar`)
                        .setDescription(settings.whitelistedBots.map(id => `\`${id}\``).join('\n'))
                    ]
                });
            } 
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}botfiltre [aç/kapat/ekle/çıkar/liste] [botid]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Bot filtresi komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};