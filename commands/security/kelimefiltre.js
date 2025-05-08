const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'kelimefiltre',
    description: 'Yasaklı kelimeleri filtreleme sistemini yönetir',
    usage: '[ekle/çıkar/liste/aç/kapat] [kelime]',
    aliases: ['badwords', 'yasaklikelimeler', 'kf'],
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
        if (!config.wordFilter) {
            config.wordFilter = {
                enabled: false,
                words: [],
                action: 'delete' // delete, warn, mute
            };
        }
        
        // Eğer argüman yoksa, filtre durumunu göster
        if (!args.length) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.info)
                    .setTitle(`${config.emojis.filter || '🧹'} Kelime Filtresi Durumu`)
                    .setDescription(`**Durum:** ${config.wordFilter.enabled ? '✅ Aktif' : '❌ Devre Dışı'}\n**Eylem:** ${getActionText(config.wordFilter.action)}\n**Yasaklı Kelime Sayısı:** ${config.wordFilter.words.length}`)
                    .addField('Kullanım', '`.kelimefiltre aç [delete/warn/mute]` - Filtreyi aktif eder\n`.kelimefiltre kapat` - Filtreyi devre dışı bırakır\n`.kelimefiltre ekle [kelime]` - Yasaklı kelime ekler\n`.kelimefiltre çıkar [kelime]` - Yasaklı kelime çıkarır\n`.kelimefiltre liste` - Yasaklı kelimeleri listeler')
                    .setFooter({ text: 'Kelime filtresi, kötü ve uygunsuz dili engellemenize yardımcı olur' })
                ]
            });
        }
        
        const subCommand = args[0].toLowerCase();
        const configPath = './config.json';
        
        // Alt komut: liste - Yasaklı kelimeleri listeler
        if (subCommand === 'liste' || subCommand === 'list') {
            if (!config.wordFilter.words.length) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Yasaklı kelime listesi boş.`)
                    ]
                });
            }
            
            // Cevap ver ve 5 saniye sonra sil (gizlilik için)
            const reply = await message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.info)
                    .setTitle(`${config.emojis.filter || '🧹'} Yasaklı Kelimeler`)
                    .setDescription(`**Toplam:** ${config.wordFilter.words.length} kelime\n\n\`\`\`${config.wordFilter.words.join(', ')}\`\`\``)
                    .setFooter({ text: 'Bu mesaj 15 saniye sonra otomatik olarak silinecektir' })
                ]
            });
            
            setTimeout(() => {
                reply.delete().catch(() => {});
                message.delete().catch(() => {});
            }, 15000);
            
            return;
        }
        
        // Alt komut: ekle - Yasaklı kelime ekler
        if (subCommand === 'ekle' || subCommand === 'add') {
            if (!args[1]) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen bir kelime belirtin. Örnek: \`.kelimefiltre ekle küfür\``)
                    ]
                });
            }
            
            const word = args[1].toLowerCase();
            
            // Kelime zaten listede mi kontrol et
            if (config.wordFilter.words.includes(word)) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} \`${word}\` zaten yasaklı kelime listesinde.`)
                    ]
                });
            }
            
            // Kelimeyi listeye ekle
            config.wordFilter.words.push(word);
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} yasaklı kelime ekledi: ${word}`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} \`${word}\` yasaklı kelime listesine eklendi.`)
                    ]
                });
            } catch (error) {
                logger.error(`Yasaklı kelime eklenirken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Yasaklı kelime eklenirken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Alt komut: çıkar - Yasaklı kelime çıkarır
        if (subCommand === 'çıkar' || subCommand === 'çikar' || subCommand === 'remove') {
            if (!args[1]) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen bir kelime belirtin. Örnek: \`.kelimefiltre çıkar küfür\``)
                    ]
                });
            }
            
            const word = args[1].toLowerCase();
            
            // Kelime listede mi kontrol et
            if (!config.wordFilter.words.includes(word)) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} \`${word}\` yasaklı kelime listesinde bulunamadı.`)
                    ]
                });
            }
            
            // Kelimeyi listeden çıkar
            config.wordFilter.words = config.wordFilter.words.filter(w => w !== word);
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} yasaklı kelime çıkardı: ${word}`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} \`${word}\` yasaklı kelime listesinden çıkarıldı.`)
                    ]
                });
            } catch (error) {
                logger.error(`Yasaklı kelime çıkarılırken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Yasaklı kelime çıkarılırken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Alt komut: aç - Filtreyi aktif eder
        if (subCommand === 'aç' || subCommand === 'aktif' || subCommand === 'on' || subCommand === 'enable') {
            // Eylem belirtilmişse ayarla
            if (args.length > 1) {
                const action = args[1].toLowerCase();
                if (['delete', 'warn', 'mute', 'sil', 'uyar', 'sustur'].includes(action)) {
                    if (action === 'sil') config.wordFilter.action = 'delete';
                    else if (action === 'uyar') config.wordFilter.action = 'warn';
                    else if (action === 'sustur') config.wordFilter.action = 'mute';
                    else config.wordFilter.action = action;
                }
            }
            
            // Varsayılan eylem olarak silme belirle
            if (!config.wordFilter.action) config.wordFilter.action = 'delete';
            
            // Filtreyi aktif et
            config.wordFilter.enabled = true;
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} kelime filtresini aktif etti. Eylem: ${config.wordFilter.action}`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Kelime filtresi \`${getActionText(config.wordFilter.action)}\` eylemiyle aktif edildi.`)
                    ]
                });
            } catch (error) {
                logger.error(`Kelime filtresi aktif edilirken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Kelime filtresi aktif edilirken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Alt komut: kapat - Filtreyi devre dışı bırakır
        if (subCommand === 'kapat' || subCommand === 'off' || subCommand === 'disable') {
            // Filtreyi devre dışı bırak
            config.wordFilter.enabled = false;
            
            // Konfigürasyonu kaydet
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
                
                // Kayıt mesajı
                logger.info(`${message.author.tag} kelime filtresini devre dışı bıraktı.`);
                
                // Cevap ver
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.success} Kelime filtresi devre dışı bırakıldı.`)
                    ]
                });
            } catch (error) {
                logger.error(`Kelime filtresi devre dışı bırakılırken hata: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Kelime filtresi devre dışı bırakılırken bir hata oluştu!`)
                    ]
                });
            }
        }
        
        // Bilinmeyen alt komut
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.error)
                .setDescription(`${config.emojis.error} Geçersiz alt komut. Kullanılabilir komutlar: \`liste\`, \`ekle\`, \`çıkar\`, \`aç\`, \`kapat\``)
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