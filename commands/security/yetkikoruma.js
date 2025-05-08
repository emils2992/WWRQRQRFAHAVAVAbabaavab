const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'yetkikoruma',
    description: 'Rollere tehlikeli yetkilerin verilmesini engelleyen sistemi kontrol eder',
    usage: '[aç/kapat] [yetki ekle/sil]',
    aliases: ['perm-guard', 'permguard', 'yetki-koruma', 'permission', 'yetkikontrol'],
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
            const settings = config.permGuard;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                // Korunan yetkileri formatla
                const permissions = settings.protectedPermissions.map(perm => `\`${perm}\``).join(', ');
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.security} Yetki Koruma Sistemi Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Korunan Yetki Sayısı', value: `${settings.protectedPermissions.length}`, inline: true }
                        )
                        .setDescription(`Yetki koruma sistemi, rollere tehlikeli yetkilerin verilmesini engeller.`)
                        .addField('Korunan Yetkiler', permissions || 'Yetki bulunamadı')
                        .setFooter({ text: `${config.prefix}yetkikoruma [aç/kapat] [yetki ekle/sil]` })
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
                            .setDescription(`${config.emojis.warning} Yetki koruma sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.permGuard.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Yetki koruma sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Yetki koruma sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.permGuard.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Yetki koruma sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Yetki ekleme/silme işlemleri
            else if (action === 'ekle' || action === 'add') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen eklemek istediğiniz yetkiyi belirtin!`)
                            .addField('Kullanılabilir Yetkiler', '`ADMINISTRATOR`, `BAN_MEMBERS`, `KICK_MEMBERS`, `MANAGE_CHANNELS`, `MANAGE_GUILD`, `MANAGE_ROLES`, `MANAGE_WEBHOOKS`, `MANAGE_MESSAGES`, `MENTION_EVERYONE`')
                        ]
                    });
                }
                
                const permission = args[1].toUpperCase();
                
                // Geçerli bir yetki mi kontrol et
                const validPermissions = [
                    'ADMINISTRATOR', 'BAN_MEMBERS', 'KICK_MEMBERS', 'MANAGE_CHANNELS',
                    'MANAGE_GUILD', 'MANAGE_ROLES', 'MANAGE_WEBHOOKS', 'MANAGE_MESSAGES',
                    'MENTION_EVERYONE'
                ];
                
                if (!validPermissions.includes(permission)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz yetki! Lütfen geçerli bir Discord yetkisi girin.`)
                            .addField('Kullanılabilir Yetkiler', '`ADMINISTRATOR`, `BAN_MEMBERS`, `KICK_MEMBERS`, `MANAGE_CHANNELS`, `MANAGE_GUILD`, `MANAGE_ROLES`, `MANAGE_WEBHOOKS`, `MANAGE_MESSAGES`, `MENTION_EVERYONE`')
                        ]
                    });
                }
                
                // Zaten ekli mi kontrol et
                if (settings.protectedPermissions.includes(permission)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Bu yetki zaten koruma listesinde!`)
                        ]
                    });
                }
                
                // Yetkiyi ekle ve kaydet
                config.permGuard.protectedPermissions.push(permission);
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} \`${permission}\` yetkisi başarıyla koruma listesine eklendi!`)
                    ]
                });
            }
            else if (action === 'sil' || action === 'kaldır' || action === 'remove' || action === 'delete') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen kaldırmak istediğiniz yetkiyi belirtin!`)
                        ]
                    });
                }
                
                const permission = args[1].toUpperCase();
                
                // Listede var mı kontrol et
                if (!settings.protectedPermissions.includes(permission)) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Bu yetki koruma listesinde değil!`)
                        ]
                    });
                }
                
                // Yetkiyi kaldır ve kaydet
                config.permGuard.protectedPermissions = config.permGuard.protectedPermissions.filter(p => p !== permission);
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} \`${permission}\` yetkisi başarıyla koruma listesinden kaldırıldı!`)
                    ]
                });
            }
            else if (action === 'liste' || action === 'list') {
                if (settings.protectedPermissions.length === 0) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.info)
                            .setDescription(`${config.emojis.info} Koruma listesinde hiç yetki bulunmuyor.`)
                        ]
                    });
                }
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.security} Korunan Yetkiler`)
                        .setDescription(settings.protectedPermissions.map(p => `\`${p}\``).join('\n'))
                    ]
                });
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}yetkikoruma [aç/kapat/ekle/sil/liste] [yetki]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Yetki koruma komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};