const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const fs = require('fs');
const path = require('path');
const emojiRegex = require('emoji-regex');

module.exports = {
    name: 'emojifiltre',
    description: 'Emoji spam ve aşırı emoji kullanımını engelleme sistemini yönetir',
    usage: '[aç/kapat] [max-emoji]',
    aliases: ['emoji-filter', 'emojilimit', 'ef'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.ADMINISTRATOR],
    cooldown: 3,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Filtre konfigürasyonunu al
        if (!config.emojiFilter) {
            config.emojiFilter = {
                enabled: false,
                maxEmojis: 5,
                action: 'delete' // delete, warn, mute
            };
        }
        
        // Eğer argüman yoksa, filtre durumunu göster
        if (!args.length) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.info)
                    .setTitle(`${config.emojis.emoji || '😀'} Emoji Filtresi Durumu`)
                    .setDescription(`**Durum:** ${config.emojiFilter.enabled ? '✅ Aktif' : '❌ Devre Dışı'}\n**Eylem:** ${getActionText(config.emojiFilter.action)}\n**Maximum Emoji:** ${config.emojiFilter.maxEmojis}`)
                    .addField('Kullanım', '`.emojifiltre aç [delete/warn/mute] [maxEmoji]` - Filtreyi aktif eder\n`.emojifiltre kapat` - Filtreyi devre dışı bırakır')
                    .setFooter({ text: 'Emoji filtresi, mesajlarda fazla emoji kullanımını engeller' })
                ]
            });
        }
        
        const subCommand = args[0].toLowerCase();
        const configPath = './config.json';
        
        // Alt komut: aç - Filtreyi aktif eder
        if (subCommand === 'aç' || subCommand === 'aktif' || subCommand === 'on' || subCommand === 'enable') {
            // Eylem belirtilmişse ayarla
            if (args.length > 1) {
                const action = args[1].toLowerCase();
                if (['delete', 'warn', 'mute', 'sil', 'uyar', 'sustur'].includes(action)) {
                    if (action === 'sil') config.emojiFilter.action = 'delete';
                    else if (action === 'uyar') config.emojiFilter.action = 'warn';
                    else if (action === 'sustur') config.emojiFilter.action = 'mute';
                    else config.emojiFilter.action = action;
                }
            }
            
            // Emoji limiti belirtilmişse ayarla
            if (args.length > 2) {
                const maxEmojis = parseInt(args[2]);
                if (!isNaN(maxEmojis) && maxEmojis > 0) {
                    config.emojiFilter.maxEmojis = maxEmojis;
                }
            }
            
            // Varsayılan eylem olarak silme belirle
            if (!config.emojiFilter.action) config.emojiFilter.action = 'delete';
            
            // Filtreyi aktif et
            config.emojiFilter.enabled = true;
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} emoji filtresini aktif etti. Eylem: ${config.emojiFilter.action}, Maximum Emoji: ${config.emojiFilter.maxEmojis}`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Emoji filtresi \`${getActionText(config.emojiFilter.action)}\` eylemiyle aktif edildi. Maksimum emoji sayısı: ${config.emojiFilter.maxEmojis}`)
                    ]
                });
            } catch (error) {
                logger.error(`Emoji filtresi aktif edilirken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Emoji filtresi aktif edilirken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Alt komut: kapat - Filtreyi devre dışı bırakır
        if (subCommand === 'kapat' || subCommand === 'off' || subCommand === 'disable') {
            // Filtreyi devre dışı bırak
            config.emojiFilter.enabled = false;
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} emoji filtresini devre dışı bıraktı.`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Emoji filtresi devre dışı bırakıldı.`)
                    ]
                });
            } catch (error) {
                logger.error(`Emoji filtresi devre dışı bırakılırken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Emoji filtresi devre dışı bırakılırken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Bilinmeyen alt komut
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.error)
                .setDescription(`${config.emojis.error} Geçersiz alt komut. Kullanılabilir komutlar: \`aç\`, \`kapat\``)
            ]
        });
    }
};

/**
 * Eylemin okunabilir adını döndürür
 * @param {string} action 
 * @returns {string}
 */
function getActionText(action) {
    switch (action) {
        case 'delete': return 'Silme';
        case 'warn': return 'Uyarı';
        case 'mute': return 'Susturma';
        default: return 'Silme';
    }
}