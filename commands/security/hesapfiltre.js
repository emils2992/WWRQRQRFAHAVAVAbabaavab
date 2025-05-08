const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'hesapfiltre',
    description: 'Yeni hesapların sunucuya girmesini engelleyen sistemi kontrol eder',
    usage: '[aç/kapat] [gün]',
    aliases: ['hesap-filtresi', 'accountfilter', 'hesap-koruma', 'yeniüye'],
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
            const settings = config.newAccountFilter;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.account} Hesap Filtresi Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Minimum Hesap Yaşı', value: `${settings.minAge} gün`, inline: true }
                        )
                        .setDescription(`Hesap filtresi, yeni oluşturulmuş hesapların sunucuya girmesini engeller.`)
                        .setFooter({ text: `${config.prefix}hesapfiltre [aç/kapat] [gün]` })
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
                            .setDescription(`${config.emojis.warning} Hesap filtresi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.newAccountFilter.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Hesap filtresi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Hesap filtresi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.newAccountFilter.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Hesap filtresi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Minimum hesap yaşını ayarla
            else if (action === 'yaş' || action === 'süre' || action === 'age' || action === 'gün' || action === 'day') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen minimum hesap yaşını belirtin (gün olarak)!`)
                        ]
                    });
                }
                
                const days = parseInt(args[1]);
                
                // Geçerli bir sayı değeri mi kontrol et
                if (isNaN(days) || days < 0 || days > 365) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz gün sayısı! Lütfen 0-365 arasında bir değer girin.`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.newAccountFilter.minAge = days;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Minimum hesap yaşı başarıyla **${days} gün** olarak ayarlandı!`)
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}hesapfiltre [aç/kapat/yaş] [gün]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Hesap filtresi komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};