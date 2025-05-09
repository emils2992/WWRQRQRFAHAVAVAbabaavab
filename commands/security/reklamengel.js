const { Message, Client, MessageEmbed } = require('discord.js');
const config = require('../../config.json');
const database = require('../../utils/database');
const logger = require('../../utils/logger');
const permissions = require('../../utils/permissions');

/**
 * Eylemin okunabilir adını döndürür
 * @param {string} action 
 * @returns {string}
 */
function getActionText(action) {
    switch (action) {
        case 'delete': return 'Mesaj Silme';
        case 'warn': return 'Uyarı';
        case 'mute': return 'Susturma';
        default: return 'Bilinmiyor';
    }
}

module.exports = {
    name: 'reklamengel',
    aliases: ['reklam-engel', 'reklam', 'advertise', 'reklamfiltre'],
    category: 'security',
    description: 'Discord davet bağlantılarını (discord.gg) engellemek için ayarları düzenler.',
    usage: 'reklamengel <aç/kapat/ayarla> [süre/eylem]',
    requiredPermissions: ['MANAGE_GUILD'],
    
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // İzin kontrolü
        if (!permissions.checkPermissions(message.member, this.requiredPermissions)) {
            logger.warn(`${message.author.tag} yetkisiz komut kullanım denemesi: ${this.name}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısınız!`)
                ]
            });
        }
        
        // Guild config al veya oluştur
        let guildConfig = database.getGuildConfig(message.guild.id);
        
        if (!guildConfig) {
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Sunucu yapılandırması yüklenemedi veya bulunamadı!`)
                ]
            });
            return;
        }
        
        // Anti-link yapılandırması yoksa oluştur
        if (!guildConfig.antiLink) {
            guildConfig.antiLink = {
                enabled: false,
                action: 'delete',
                muteDuration: 10,
                maxWarnings: 3,
                whitelist: []
            };
        }
        
        // Argümanlar yoksa mevcut ayarları göster
        if (!args.length) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.info)
                    .setTitle(`${config.emojis.settings || '⚙️'} Reklam Engelleme Ayarları`)
                    .setDescription(`Discord davet bağlantılarını (discord.gg) ve diğer reklamları engelleme ayarları:`)
                    .addFields(
                        { name: 'Durum', value: guildConfig.antiLink.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
                        { name: 'Eylem Türü', value: getActionText(guildConfig.antiLink.action), inline: true },
                        { name: 'Susturma Süresi', value: `${guildConfig.antiLink.muteDuration || 10} dakika`, inline: true },
                        { name: 'Maksimum Uyarı', value: `${guildConfig.antiLink.maxWarnings || 3} kez`, inline: true }
                    )
                    .addField('Komut Kullanımı', `${config.prefix}reklamengel aç - Discord davet reklamlarını engeller\n${config.prefix}reklamengel kapat - Engellemeyi devre dışı bırakır\n${config.prefix}reklamengel eylem <sil/uyar/sustur> - Reklam yapılınca uygulanacak eylemi ayarlar\n${config.prefix}reklamengel süre <dakika> - Susturma süresini ayarlar\n${config.prefix}reklamengel uyarı <sayı> - Maksimum uyarı sayısını ayarlar`)
                    .setFooter({ text: 'Astro Bot Güvenlik Sistemi' })
                ]
            });
        }
        
        const command = args[0].toLowerCase();
        
        // Reklam engellemeyi aç/kapat
        if (command === 'aç' || command === 'aktif' || command === 'on' || command === 'açık') {
            guildConfig.antiLink.enabled = true;
            
            database.setGuildConfig(message.guild.id, guildConfig);
            
            logger.security('REKLAM_ENGEL', `${message.author.tag} tarafından ${message.guild.name} sunucusunda Reklam Engelleme aktif edildi`);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.success} Reklam engelleme sistemi başarıyla **aktif** edildi! \n\nArtık sunucuda paylaşılan Discord davet bağlantıları (discord.gg) otomatik olarak engellenecek ve **${getActionText(guildConfig.antiLink.action)}** işlemi uygulanacak.`)
                ]
            });
        }
        
        // Reklam engellemeyi kapat
        if (command === 'kapat' || command === 'devre-dışı' || command === 'off' || command === 'kapalı') {
            guildConfig.antiLink.enabled = false;
            
            database.setGuildConfig(message.guild.id, guildConfig);
            
            logger.security('REKLAM_ENGEL', `${message.author.tag} tarafından ${message.guild.name} sunucusunda Reklam Engelleme devre dışı bırakıldı`);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.success} Reklam engelleme sistemi **devre dışı** bırakıldı! \n\nArtık Discord davet bağlantıları (discord.gg) engellenmeyecek.`)
                ]
            });
        }
        
        // Eylem türünü ayarla (sil/uyar/sustur)
        if (command === 'eylem' || command === 'action' || command === 'işlem') {
            if (!args[1]) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Lütfen bir eylem türü belirtin: \`sil\`, \`uyar\` veya \`sustur\`.`)
                    ]
                });
            }
            
            const action = args[1].toLowerCase();
            let actionType = '';
            
            if (action === 'sil' || action === 'delete') {
                actionType = 'delete';
            } else if (action === 'uyar' || action === 'warn') {
                actionType = 'warn';
            } else if (action === 'sustur' || action === 'mute') {
                actionType = 'mute';
            } else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Geçersiz eylem türü! Lütfen \`sil\`, \`uyar\` veya \`sustur\` seçeneklerinden birini kullanın.`)
                    ]
                });
            }
            
            guildConfig.antiLink.action = actionType;
            database.setGuildConfig(message.guild.id, guildConfig);
            
            logger.security('REKLAM_ENGEL', `${message.author.tag} tarafından ${message.guild.name} sunucusunda Reklam Engelleme eylem türü ${getActionText(actionType)} olarak ayarlandı`);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.success} Reklam engelleme eylem türü **${getActionText(actionType)}** olarak ayarlandı! \n\nArtık reklam yapıldığında bu eylem uygulanacak.`)
                ]
            });
        }
        
        // Susturma süresini ayarla
        if (command === 'süre' || command === 'sure' || command === 'duration' || command === 'zaman') {
            if (!args[1] || isNaN(args[1]) || parseInt(args[1]) < 1) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Lütfen geçerli bir süre (dakika cinsinden) belirtin.`)
                    ]
                });
            }
            
            const duration = parseInt(args[1]);
            guildConfig.antiLink.muteDuration = duration;
            database.setGuildConfig(message.guild.id, guildConfig);
            
            logger.security('REKLAM_ENGEL', `${message.author.tag} tarafından ${message.guild.name} sunucusunda Reklam Engelleme susturma süresi ${duration} dakika olarak ayarlandı`);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.success} Reklam engelleme susturma süresi **${duration} dakika** olarak ayarlandı! \n\nArtık reklam yapan kullanıcılar bu süre boyunca susturulacak.`)
                ]
            });
        }
        
        // Maksimum uyarı sayısını ayarla
        if (command === 'uyarı' || command === 'uyari' || command === 'max' || command === 'maxwarning') {
            if (!args[1] || isNaN(args[1]) || parseInt(args[1]) < 1) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Lütfen geçerli bir uyarı sayısı belirtin.`)
                    ]
                });
            }
            
            const maxWarnings = parseInt(args[1]);
            guildConfig.antiLink.maxWarnings = maxWarnings;
            database.setGuildConfig(message.guild.id, guildConfig);
            
            logger.security('REKLAM_ENGEL', `${message.author.tag} tarafından ${message.guild.name} sunucusunda Reklam Engelleme maksimum uyarı sayısı ${maxWarnings} olarak ayarlandı`);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.success} Reklam engelleme maksimum uyarı sayısı **${maxWarnings}** olarak ayarlandı! \n\nKullanıcı ${maxWarnings} kez uyarıldıktan sonra seçilen eylem otomatik olarak uygulanacak.`)
                ]
            });
        }
        
        // Diğer durumlar için yardım mesajı
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.warning)
                .setTitle(`${config.emojis.warning} Bilinmeyen Alt Komut`)
                .setDescription(`Kullanılabilir alt komutlar: \`aç\`, \`kapat\`, \`eylem\`, \`süre\`, \`uyarı\`.`)
                .addField('Komut Kullanımı', `${config.prefix}reklamengel aç - Discord davet reklamlarını engeller\n${config.prefix}reklamengel kapat - Engellemeyi devre dışı bırakır\n${config.prefix}reklamengel eylem <sil/uyar/sustur> - Reklam yapılınca uygulanacak eylemi ayarlar\n${config.prefix}reklamengel süre <dakika> - Susturma süresini ayarlar\n${config.prefix}reklamengel uyarı <sayı> - Maksimum uyarı sayısını ayarlar`)
            ]
        });
    }
};