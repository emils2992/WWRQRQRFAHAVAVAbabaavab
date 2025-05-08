const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'linkkoruma',
    description: 'Sunucuda paylaşılan linkleri kontrol eden sistemi yönetir',
    usage: '[aç/kapat] [eylem/beyazliste] [değer]',
    aliases: ['antilink', 'link-guard', 'link-koruma', 'reklamengel', 'reklam-engel'],
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
            const settings = config.antiLink;
            
            // Eğer argüman yoksa, mevcut durumu göster
            if (!args.length) {
                const whitelist = settings.whitelist.length > 0 
                    ? settings.whitelist.map(domain => `\`${domain}\``).join(', ')
                    : 'Beyaz liste boş';
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.link} Link Koruma Ayarları`)
                        .addFields(
                            { name: 'Durum', value: settings.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                            { name: 'Eylem', value: settings.action === 'delete' ? '🗑️ Sil' : 
                                           settings.action === 'warn' ? '⚠️ Uyar' : 
                                           settings.action === 'mute' ? '🔇 Sustur' : 'Bilinmiyor', inline: true },
                            { name: 'Susturma Süresi', value: `${settings.muteDuration} dakika`, inline: true }
                        )
                        .setDescription(`Link koruma sistemi, izin verilmeyen linklerin paylaşılmasını engeller.`)
                        .addField('Beyaz Liste', whitelist)
                        .setFooter({ text: `${config.prefix}linkkoruma [aç/kapat] [eylem/beyazliste] [değer]` })
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
                            .setDescription(`${config.emojis.warning} Link koruma sistemi zaten aktif!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiLink.enabled = true;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Link koruma sistemi başarıyla **aktif** edildi!`)
                    ]
                });
            } 
            else if (action === 'kapat' || action === 'kapalı' || action === 'off' || action === 'disable') {
                if (!settings.enabled) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setDescription(`${config.emojis.warning} Link koruma sistemi zaten devre dışı!`)
                        ]
                    });
                }
                
                // Değişikliği yap ve kaydet
                config.antiLink.enabled = false;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Link koruma sistemi başarıyla **devre dışı** bırakıldı!`)
                    ]
                });
            }
            // Eylem ayarlama
            else if (action === 'eylem' || action === 'action' || action === 'ceza' || action === 'işlem') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen link tespit edildiğinde uygulanacak eylemi belirtin! (sil/uyar/sustur)`)
                        ]
                    });
                }
                
                const actionType = args[1].toLowerCase();
                
                if (actionType === 'sil' || actionType === 'delete' || actionType === 'remove') {
                    config.antiLink.action = 'delete';
                }
                else if (actionType === 'uyar' || actionType === 'warn' || actionType === 'warning') {
                    config.antiLink.action = 'warn';
                }
                else if (actionType === 'sustur' || actionType === 'mute') {
                    config.antiLink.action = 'mute';
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz eylem türü! Lütfen 'sil', 'uyar' veya 'sustur' olarak belirtin.`)
                        ]
                    });
                }
                
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Link eylem türü başarıyla **${config.antiLink.action}** olarak ayarlandı!`)
                    ]
                });
            }
            // Susturma süresi ayarlama
            else if (action === 'süre' || action === 'duration' || action === 'mute-time') {
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
                            .setDescription(`${config.emojis.error} Geçersiz süre! Lütfen 1-1440 arasında bir değer girin (dakika).`)
                        ]
                    });
                }
                
                // Değeri ayarla ve kaydet
                config.antiLink.muteDuration = minutes;
                require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Link paylaşımı için susturma süresi başarıyla **${minutes} dakika** olarak ayarlandı!`)
                    ]
                });
            }
            // Beyaz liste yönetimi
            else if (action === 'beyazliste' || action === 'whitelist' || action === 'izinli') {
                if (args.length < 2) {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Lütfen bir eylem (ekle/sil/liste) ve gerektiğinde domain belirtin!`)
                        ]
                    });
                }
                
                const subAction = args[1].toLowerCase();
                
                if (subAction === 'ekle' || subAction === 'add') {
                    if (args.length < 3) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.error)
                                .setDescription(`${config.emojis.error} Lütfen beyaz listeye eklenecek domain adını belirtin!`)
                            ]
                        });
                    }
                    
                    const domain = args[2].toLowerCase()
                        .replace('http://', '')
                        .replace('https://', '')
                        .replace('www.', '')
                        .split('/')[0];
                    
                    // Geçerli bir domain mi kontrol et
                    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.error)
                                .setDescription(`${config.emojis.error} Geçersiz domain formatı! Lütfen "example.com" formatında bir domain girin.`)
                            ]
                        });
                    }
                    
                    // Zaten listede mi kontrol et
                    if (settings.whitelist.includes(domain)) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.warning)
                                .setDescription(`${config.emojis.warning} \`${domain}\` zaten beyaz listede!`)
                            ]
                        });
                    }
                    
                    // Değeri ekle ve kaydet
                    config.antiLink.whitelist.push(domain);
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} \`${domain}\` başarıyla beyaz listeye eklendi!`)
                        ]
                    });
                }
                else if (subAction === 'sil' || subAction === 'remove' || subAction === 'delete') {
                    if (args.length < 3) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.error)
                                .setDescription(`${config.emojis.error} Lütfen beyaz listeden silinecek domain adını belirtin!`)
                            ]
                        });
                    }
                    
                    const domain = args[2].toLowerCase()
                        .replace('http://', '')
                        .replace('https://', '')
                        .replace('www.', '')
                        .split('/')[0];
                    
                    // Listede var mı kontrol et
                    if (!settings.whitelist.includes(domain)) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.warning)
                                .setDescription(`${config.emojis.warning} \`${domain}\` beyaz listede bulunamadı!`)
                            ]
                        });
                    }
                    
                    // Değeri çıkar ve kaydet
                    config.antiLink.whitelist = config.antiLink.whitelist.filter(d => d !== domain);
                    require('fs').writeFileSync('./config.json', JSON.stringify(config, null, 4));
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.success} \`${domain}\` başarıyla beyaz listeden çıkarıldı!`)
                        ]
                    });
                }
                else if (subAction === 'liste' || subAction === 'list') {
                    if (settings.whitelist.length === 0) {
                        return message.reply({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.info)
                                .setDescription(`${config.emojis.info} Beyaz listede hiç domain bulunmuyor.`)
                            ]
                        });
                    }
                    
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.info)
                            .setTitle(`${config.emojis.link} İzin Verilen Domainler`)
                            .setDescription(settings.whitelist.map(domain => `\`${domain}\``).join('\n'))
                        ]
                    });
                }
                else {
                    return message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setDescription(`${config.emojis.error} Geçersiz beyaz liste işlemi! Lütfen 'ekle', 'sil' veya 'liste' olarak belirtin.`)
                        ]
                    });
                }
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz komut kullanımı! Lütfen şu şekilde deneyin: \`${config.prefix}linkkoruma [aç/kapat/eylem/süre/beyazliste] [değer]\``)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Link koruma komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};