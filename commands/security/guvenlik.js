const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'güvenlik',
    description: 'Sunucunun güvenlik ayarlarını görüntüler ve yönetir',
    usage: '[ayarla/sıfırla/bilgi] [özellik] [değer]',
    aliases: ['security', 'guvenlik', 'koruma', 'g'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.ADMINISTRATOR],
    cooldown: 3,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Sunucu konfigürasyonunu al
        const guildConfig = database.getGuildConfig(message.guild.id) || {};
        
        // Eğer hiç argüman yoksa, güvenlik durumunu göster
        if (!args.length) {
            return sendSecurityStatus(message, client, guildConfig);
        }
        
        const subCommand = args[0].toLowerCase();
        
        // Alt komut: bilgi - Belirli bir güvenlik özelliği hakkında bilgi verir
        if (subCommand === 'bilgi' || subCommand === 'info') {
            const feature = args[1]?.toLowerCase();
            if (!feature) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen bir güvenlik özelliği belirtin. Örnek: \`.güvenlik bilgi antilink\``)
                    ]
                });
            }
            
            return showFeatureInfo(message, feature);
        }
        
        // Alt komut: ayarla - Bir güvenlik özelliğini açar veya ayarlar
        if (subCommand === 'ayarla' || subCommand === 'set' || subCommand === 'enable' || subCommand === 'aç') {
            const feature = args[1]?.toLowerCase();
            if (!feature) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen bir güvenlik özelliği belirtin. Örnek: \`.güvenlik ayarla antilink\``)
                    ]
                });
            }
            
            // Özelliği ayarla
            return setSecurityFeature(message, client, feature, args.slice(2), guildConfig);
        }
        
        // Alt komut: sıfırla - Bir güvenlik özelliğini kapatır
        if (subCommand === 'sıfırla' || subCommand === 'reset' || subCommand === 'disable' || subCommand === 'kapat') {
            const feature = args[1]?.toLowerCase();
            if (!feature) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen bir güvenlik özelliği belirtin. Örnek: \`.güvenlik sıfırla antilink\``)
                    ]
                });
            }
            
            // Özelliği sıfırla
            return resetSecurityFeature(message, client, feature, guildConfig);
        }
        
        // Bilinmeyen alt komut
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.error)
                .setDescription(`${config.emojis.error} Geçersiz alt komut. Kullanılabilir komutlar: \`bilgi\`, \`ayarla\`, \`sıfırla\``)
            ]
        });
    }
};

/**
 * Sunucunun güvenlik durumunu gösterir
 * @param {Message} message 
 * @param {Client} client 
 * @param {Object} guildConfig 
 */
function sendSecurityStatus(message, client, guildConfig) {
    // Ana embed oluştur
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTitle(`${config.emojis.shield || '🛡️'} Sunucu Güvenlik Durumu`)
        .setDescription(`${message.guild.name} sunucusu için güvenlik ayarları aşağıda listelenmiştir.`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Astro Bot Güvenlik Sistemi', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    // Anti-Bot durumu
    const antiBotEnabled = config.antiBot?.enabled;
    embed.addField(
        `${config.emojis.bot || '🤖'} Anti-Bot`,
        `Durum: ${antiBotEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Açıklama: Bilinmeyen botların sunucunuza eklenmesini engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla antibot\``,
        false
    );
    
    // Anti-Link durumu
    const antiLinkEnabled = config.antiLink?.enabled;
    embed.addField(
        `${config.emojis.link || '🔗'} Anti-Link`,
        `Durum: ${antiLinkEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Eylem: ${getActionText(config.antiLink?.action)}\n` +
        `Açıklama: Discord davetleri ve diğer bağlantıları engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla antilink\``,
        false
    );
    
    // Anti-Spam durumu
    const antiSpamEnabled = config.antiSpam?.enabled;
    embed.addField(
        `${config.emojis.spam || '🔄'} Anti-Spam`,
        `Durum: ${antiSpamEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Limit: ${config.antiSpam?.messageLimit || 5} mesaj / ${config.antiSpam?.timeWindow || 5} saniye\n` +
        `Açıklama: Hızlı mesaj spam'ını engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla antispam\``,
        false
    );
    
    // Anti-Raid durumu
    const antiRaidEnabled = config.antiRaid?.enabled;
    embed.addField(
        `${config.emojis.raid || '🚨'} Anti-Raid`,
        `Durum: ${antiRaidEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Limit: ${config.antiRaid?.joinLimit || 10} kişi / ${config.antiRaid?.timeWindow || 10} saniye\n` +
        `Açıklama: Ani üye artışlarını tespit eder ve sunucuyu korur\n` +
        `Ayarlamak için: \`.güvenlik ayarla antiraid\``,
        false
    );
    
    // New Account Filter durumu
    const newAccountFilterEnabled = config.newAccountFilter?.enabled;
    embed.addField(
        `${config.emojis.account || '👤'} Hesap Filtresi`,
        `Durum: ${newAccountFilterEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Minimum Yaş: ${config.newAccountFilter?.minAge || 7} gün\n` +
        `Açıklama: Yeni oluşturulmuş hesapların girişini engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla hesapfiltre\``,
        false
    );
    
    // Permission Guard durumu
    const permGuardEnabled = config.permGuard?.enabled;
    embed.addField(
        `${config.emojis.security || '🔐'} Yetki Koruma`,
        `Durum: ${permGuardEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Açıklama: Tehlikeli yetkilerin verilmesini engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla yetkikoruma\``,
        false
    );
    
    // Kelime filtresi durumu
    const wordFilterEnabled = config.wordFilter?.enabled;
    embed.addField(
        `${config.emojis.filter || '🧹'} Kelime Filtresi`,
        `Durum: ${wordFilterEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Eylem: ${getActionText(config.wordFilter?.action)}\n` +
        `Yasaklı Kelime Sayısı: ${config.wordFilter?.bannedWords?.length || 0}\n` +
        `Açıklama: Yasaklı kelimeleri ve küfürleri engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla kelimefiltre\``,
        false
    );
    
    // Emoji filtresi durumu
    const emojiFilterEnabled = config.emojiFilter?.enabled;
    embed.addField(
        `${config.emojis.emoji || '😀'} Emoji Filtresi`,
        `Durum: ${emojiFilterEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Eylem: ${getActionText(config.emojiFilter?.action)}\n` +
        `Emoji Limiti: ${config.emojiFilter?.maxEmojis || 5}\n` +
        `Açıklama: Aşırı emoji kullanımını engeller\n` +
        `Ayarlamak için: \`.güvenlik ayarla emojifiltre\``,
        false
    );

    // Limits durumu
    const limitsEnabled = config.limits?.enabled;
    embed.addField(
        `${config.emojis.limit || '⚠️'} İşlem Limitleri`,
        `Durum: ${limitsEnabled ? '✅ Aktif' : '❌ Devre Dışı'}\n` +
        `Ban Limiti: ${config.limits?.banLimit || 3} / saat\n` +
        `Kick Limiti: ${config.limits?.kickLimit || 3} / saat\n` +
        `Kanal Oluşturma: ${config.limits?.channelCreateLimit || 2} / saat\n` +
        `Rol Oluşturma: ${config.limits?.roleCreateLimit || 2} / saat\n` +
        `Açıklama: Yönetici işlemlerini sınırlar\n` +
        `Ayarlamak için: \`.güvenlik ayarla limit\``,
        false
    );
    
    return message.reply({ embeds: [embed] });
}

/**
 * Belirli bir güvenlik özelliği hakkında bilgi verir
 * @param {Message} message 
 * @param {string} feature 
 */
function showFeatureInfo(message, feature) {
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTimestamp();
    
    switch (feature) {
        case 'antibot':
        case 'botfiltre':
            embed.setTitle(`${config.emojis.bot || '🤖'} Anti-Bot Koruma`)
                .setDescription('Bu özellik, sunucunuza eklenmek istenen botları filtrelemenizi sağlar.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Bir bot sunucuya eklendiğinde, bot sahibinin onayladığı botlar dışındakiler otomatik olarak atılır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla antibot` - Bot korumasını aktif eder\n`.güvenlik sıfırla antibot` - Bot korumasını devre dışı bırakır' },
                    { name: 'İpucu', value: 'Whitelist\'e bot eklemek için `.botfiltre ekle <botID>` komutunu kullanabilirsiniz.' }
                );
            break;
            
        case 'antilink':
        case 'linkkoruma':
            embed.setTitle(`${config.emojis.link || '🔗'} Anti-Link Koruma`)
                .setDescription('Bu özellik, sunucunuzda paylaşılan linkleri engeller.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Kullanıcılar tarafından gönderilen mesajlar içindeki linkler algılanır ve seçilen eyleme göre (silme, uyarı, susturma) işlem yapılır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla antilink [delete/warn/mute]` - Link korumasını seçilen eylemle aktif eder\n`.güvenlik sıfırla antilink` - Link korumasını devre dışı bırakır' },
                    { name: 'İpucu', value: 'Belirli kanallarda link paylaşımına izin vermek için `.linkkoruma kanal-ekle #kanal` komutunu kullanabilirsiniz.' }
                );
            break;
            
        case 'antispam':
        case 'spamkoruma':
            embed.setTitle(`${config.emojis.spam || '🔄'} Anti-Spam Koruma`)
                .setDescription('Bu özellik, kısa sürede çok sayıda mesaj gönderen kullanıcıları tespit eder.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Kullanıcıların belirli bir süre içinde gönderdiği mesaj sayısı kontrol edilir ve limiti aşanlar için eylem alınır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla antispam [mesaj sayısı] [saniye]` - Spam korumasını belirtilen değerlerle aktif eder\n`.güvenlik sıfırla antispam` - Spam korumasını devre dışı bırakır' },
                    { name: 'İpucu', value: 'Yetkililerin mesajları spam olarak değerlendirilmez.' }
                );
            break;
            
        case 'antiraid':
        case 'baskınkoruma':
            embed.setTitle(`${config.emojis.raid || '🚨'} Anti-Raid Koruma`)
                .setDescription('Bu özellik, sunucunuza karşı yapılan baskın saldırılarını (kısa sürede çok sayıda üye girişi) tespit eder.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Belirli bir süre içinde sunucuya katılan kullanıcı sayısı takip edilir ve limit aşılırsa sunucu otomatik olarak kilitlenir.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla antiraid [kişi sayısı] [saniye]` - Raid korumasını belirtilen değerlerle aktif eder\n`.güvenlik sıfırla antiraid` - Raid korumasını devre dışı bırakır' },
                    { name: 'İpucu', value: 'Baskın tespit edildiğinde, sunucu sahibine ve yetkililere bildirim gönderilir.' }
                );
            break;
            
        case 'hesapfiltre':
        case 'hesap':
        case 'newaccount':
            embed.setTitle(`${config.emojis.account || '👤'} Hesap Filtresi`)
                .setDescription('Bu özellik, yeni oluşturulmuş Discord hesaplarının sunucunuza girmesini engeller.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Sunucuya katılmak isteyen kullanıcıların hesap yaşı kontrol edilir ve belirlenen süreden daha yeni hesaplar engellenir.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla hesapfiltre [gün]` - Hesap filtresini belirtilen gün değeriyle aktif eder\n`.güvenlik sıfırla hesapfiltre` - Hesap filtresini devre dışı bırakır' },
                    { name: 'İpucu', value: 'Bu özellik, raid saldırılarına ve sahte hesaplara karşı etkili bir koruma sağlar.' }
                );
            break;
            
        case 'yetkikoruma':
        case 'permguard':
            embed.setTitle(`${config.emojis.security || '🔐'} Yetki Koruma`)
                .setDescription('Bu özellik, tehlikeli yetkilerin verilmesini engeller ve kritik rol değişikliklerini takip eder.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Rollere verilen yetkiler ve kullanıcılara eklenen roller izlenir. Tehlikeli yetkiler verildiğinde işlem engellenir veya geri alınır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla yetkikoruma` - Yetki korumasını aktif eder\n`.güvenlik sıfırla yetkikoruma` - Yetki korumasını devre dışı bırakır' },
                    { name: 'İpucu', value: 'Bu özellik, yetkili hesapları ele geçirilmesine karşı sunucunuzu korur.' }
                );
            break;
            
        case 'limit':
        case 'limits':
        case 'limitler':
            embed.setTitle(`${config.emojis.limit || '⚠️'} İşlem Limitleri`)
                .setDescription('Bu özellik, yönetici işlemlerini (ban, kick, kanal/rol oluşturma vb.) sınırlar.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Yetkililer tarafından gerçekleştirilen işlemler sayılır ve belirli bir süre içinde limit aşılırsa işlemler engellenir.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla limit [banLimit] [kickLimit] [channelLimit] [roleLimit]` - Limitleri belirtilen değerlerle aktif eder\n`.güvenlik sıfırla limit` - Limitleri devre dışı bırakır' },
                    { name: 'İpucu', value: 'Sunucu sahibi her zaman limitlerin dışındadır.' }
                );
            break;
            
        case 'kelimefiltre':
        case 'wordfilter':
            embed.setTitle(`${config.emojis.filter || '🧹'} Kelime Filtresi`)
                .setDescription('Bu özellik, sunucunuzda yasaklı kelimeleri ve küfürleri engeller.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Kullanıcılar tarafından gönderilen mesajlardaki yasaklı kelimeler algılanır ve seçilen eyleme göre (silme, uyarı, susturma) işlem yapılır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla kelimefiltre [delete/warn/mute]` - Kelime filtresini seçilen eylemle aktif eder\n`.güvenlik sıfırla kelimefiltre` - Kelime filtresini devre dışı bırakır' },
                    { name: 'İpucu', value: 'Yasaklı kelimeler eklemek için `.kelimefiltre ekle <kelime>` komutunu kullanabilirsiniz.' }
                );
            break;
            
        case 'emojifiltre':
        case 'emojifilter':
            embed.setTitle(`${config.emojis.emoji || '😀'} Emoji Filtresi`)
                .setDescription('Bu özellik, sunucunuzda aşırı emoji kullanımını engeller.')
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Kullanıcılar tarafından gönderilen mesajlardaki emoji sayısı kontrol edilir ve belirlenen limiti aşanlar için seçilen eyleme göre (silme, uyarı, susturma) işlem yapılır.' },
                    { name: 'Komutlar', value: '`.güvenlik ayarla emojifiltre [delete/warn/mute] [maxEmoji]` - Emoji filtresini seçilen eylemle aktif eder\n`.güvenlik sıfırla emojifiltre` - Emoji filtresini devre dışı bırakır' },
                    { name: 'İpucu', value: 'Emoji limitini ve eylemini doğrudan `.emojifiltre aç [eylem] [maxEmoji]` komutuyla da ayarlayabilirsiniz.' }
                );
            break;
            
        default:
            embed.setTitle(`${config.emojis.error} Bilinmeyen Özellik`)
                .setColor(config.embedColors.error)
                .setDescription(`\`${feature}\` isimli bir güvenlik özelliği bulunamadı.\n\nKullanılabilir özellikler: \`antibot\`, \`antilink\`, \`antispam\`, \`antiraid\`, \`hesapfiltre\`, \`kelimefiltre\`, \`emojifiltre\`, \`yetkikoruma\`, \`limit\``)
                .addField('İpucu', 'Tüm güvenlik özelliklerini görmek için `.güvenlik` komutunu kullanabilirsiniz.');
    }
    
    return message.reply({ embeds: [embed] });
}

/**
 * Bir güvenlik özelliğini ayarlar
 * @param {Message} message 
 * @param {Client} client 
 * @param {string} feature 
 * @param {string[]} args 
 * @param {Object} guildConfig 
 */
function setSecurityFeature(message, client, feature, args, guildConfig) {
    // Konfigürasyonu güncelle
    let configChanged = true;
    const configPath = './config.json';
    let config;
    
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
        logger.error(`Failed to read config: ${error.message}`);
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.error)
                .setDescription(`${config.emojis.error} Konfigürasyon dosyası okunamadı!`)
            ]
        });
    }
    
    const embed = new MessageEmbed()
        .setColor(config.embedColors.success)
        .setTimestamp();
    
    switch (feature) {
        case 'antibot':
        case 'botfiltre':
            if (!config.antiBot) config.antiBot = {};
            config.antiBot.enabled = true;
            embed.setTitle(`${config.emojis.bot || '🤖'} Bot Koruma Aktif`)
                .setDescription('Artık sunucunuza onaylanmamış botlar eklenemeyecek.')
                .addField('İpucu', 'Whitelist\'e bot eklemek için `.botfiltre ekle <botID>` komutunu kullanabilirsiniz.');
            break;
            
        case 'antilink':
        case 'linkkoruma':
            if (!config.antiLink) config.antiLink = {};
            config.antiLink.enabled = true;
            
            // Eylem belirtilmişse ayarla
            if (args.length > 0) {
                const action = args[0].toLowerCase();
                if (['delete', 'warn', 'mute', 'sil', 'uyar', 'sustur'].includes(action)) {
                    if (action === 'sil') config.antiLink.action = 'delete';
                    else if (action === 'uyar') config.antiLink.action = 'warn';
                    else if (action === 'sustur') config.antiLink.action = 'mute';
                    else config.antiLink.action = action;
                }
            }
            
            // Varsayılan eylem olarak silme belirle
            if (!config.antiLink.action) config.antiLink.action = 'delete';
            
            embed.setTitle(`${config.emojis.link || '🔗'} Link Koruma Aktif`)
                .setDescription(`Link koruması \`${getActionText(config.antiLink.action)}\` eylemiyle aktif edildi.`)
                .addField('İpucu', 'Link eylemini değiştirmek için `.güvenlik ayarla antilink [delete/warn/mute]` komutunu kullanabilirsiniz.');
            break;
            
        case 'antispam':
        case 'spamkoruma':
            if (!config.antiSpam) config.antiSpam = {};
            config.antiSpam.enabled = true;
            
            // Spam limiti ve süre belirtilmişse ayarla
            if (args.length >= 2) {
                const messageLimit = parseInt(args[0]);
                const timeWindow = parseInt(args[1]);
                
                if (!isNaN(messageLimit) && !isNaN(timeWindow)) {
                    config.antiSpam.messageLimit = messageLimit;
                    config.antiSpam.timeWindow = timeWindow;
                }
            }
            
            // Varsayılan değerler
            if (!config.antiSpam.messageLimit) config.antiSpam.messageLimit = 5;
            if (!config.antiSpam.timeWindow) config.antiSpam.timeWindow = 5;
            
            embed.setTitle(`${config.emojis.spam || '🔄'} Spam Koruma Aktif`)
                .setDescription(`Spam koruması ${config.antiSpam.messageLimit} mesaj / ${config.antiSpam.timeWindow} saniye limiti ile aktif edildi.`)
                .addField('İpucu', 'Spam limitini değiştirmek için `.güvenlik ayarla antispam [mesaj sayısı] [saniye]` komutunu kullanabilirsiniz.');
            break;
            
        case 'antiraid':
        case 'baskınkoruma':
            if (!config.antiRaid) config.antiRaid = {};
            config.antiRaid.enabled = true;
            
            // Raid limiti ve süre belirtilmişse ayarla
            if (args.length >= 2) {
                const joinLimit = parseInt(args[0]);
                const timeWindow = parseInt(args[1]);
                
                if (!isNaN(joinLimit) && !isNaN(timeWindow)) {
                    config.antiRaid.joinLimit = joinLimit;
                    config.antiRaid.timeWindow = timeWindow;
                }
            }
            
            // Varsayılan değerler
            if (!config.antiRaid.joinLimit) config.antiRaid.joinLimit = 10;
            if (!config.antiRaid.timeWindow) config.antiRaid.timeWindow = 10;
            
            embed.setTitle(`${config.emojis.raid || '🚨'} Baskın Koruma Aktif`)
                .setDescription(`Baskın koruması ${config.antiRaid.joinLimit} kişi / ${config.antiRaid.timeWindow} saniye limiti ile aktif edildi.`)
                .addField('İpucu', 'Baskın limitini değiştirmek için `.güvenlik ayarla antiraid [kişi sayısı] [saniye]` komutunu kullanabilirsiniz.');
            break;
            
        case 'hesapfiltre':
        case 'hesap':
        case 'newaccount':
            if (!config.newAccountFilter) config.newAccountFilter = {};
            config.newAccountFilter.enabled = true;
            
            // Minimum hesap yaşı belirtilmişse ayarla
            if (args.length > 0) {
                const minAge = parseInt(args[0]);
                
                if (!isNaN(minAge)) {
                    config.newAccountFilter.minAge = minAge;
                }
            }
            
            // Varsayılan değer
            if (!config.newAccountFilter.minAge) config.newAccountFilter.minAge = 7;
            
            embed.setTitle(`${config.emojis.account || '👤'} Hesap Filtresi Aktif`)
                .setDescription(`Hesap filtresi ${config.newAccountFilter.minAge} gün minimum yaş limiti ile aktif edildi.`)
                .addField('İpucu', 'Minimum yaşı değiştirmek için `.güvenlik ayarla hesapfiltre [gün]` komutunu kullanabilirsiniz.');
            break;
            
        case 'yetkikoruma':
        case 'permguard':
            if (!config.permGuard) config.permGuard = {};
            config.permGuard.enabled = true;
            
            embed.setTitle(`${config.emojis.security || '🔐'} Yetki Koruma Aktif`)
                .setDescription('Yetki koruma sistemi aktif edildi. Tehlikeli yetkiler ve kritik rol değişiklikleri engellenecek.')
                .addField('İpucu', 'Koruma sağlanan yetkiler: ADMINISTRATOR, BAN_MEMBERS, KICK_MEMBERS, MANAGE_GUILD, MANAGE_ROLES, MANAGE_WEBHOOKS, MANAGE_CHANNELS');
            break;
            
        case 'limit':
        case 'limits':
        case 'limitler':
            if (!config.limits) config.limits = {};
            config.limits.enabled = true;
            
            // Limitleri belirtilmişse ayarla
            if (args.length >= 1) {
                const banLimit = parseInt(args[0]);
                const kickLimit = args.length >= 2 ? parseInt(args[1]) : null;
                const channelCreateLimit = args.length >= 3 ? parseInt(args[2]) : null;
                const roleCreateLimit = args.length >= 4 ? parseInt(args[3]) : null;
                
                if (!isNaN(banLimit)) config.limits.banLimit = banLimit;
                if (kickLimit !== null && !isNaN(kickLimit)) config.limits.kickLimit = kickLimit;
                if (channelCreateLimit !== null && !isNaN(channelCreateLimit)) config.limits.channelCreateLimit = channelCreateLimit;
                if (roleCreateLimit !== null && !isNaN(roleCreateLimit)) config.limits.roleCreateLimit = roleCreateLimit;
            }
            
            // Varsayılan değerler
            if (!config.limits.banLimit) config.limits.banLimit = 3;
            if (!config.limits.kickLimit) config.limits.kickLimit = 3;
            if (!config.limits.channelCreateLimit) config.limits.channelCreateLimit = 2;
            if (!config.limits.roleCreateLimit) config.limits.roleCreateLimit = 2;
            
            embed.setTitle(`${config.emojis.limit || '⚠️'} İşlem Limitleri Aktif`)
                .setDescription('İşlem limitleri aşağıdaki değerlerle aktif edildi:')
                .addFields(
                    { name: 'Ban Limiti', value: `${config.limits.banLimit} / saat`, inline: true },
                    { name: 'Kick Limiti', value: `${config.limits.kickLimit} / saat`, inline: true },
                    { name: 'Kanal Oluşturma', value: `${config.limits.channelCreateLimit} / saat`, inline: true },
                    { name: 'Rol Oluşturma', value: `${config.limits.roleCreateLimit} / saat`, inline: true }
                )
                .addField('İpucu', 'Limitleri değiştirmek için `.güvenlik ayarla limit [banLimit] [kickLimit] [channelLimit] [roleLimit]` komutunu kullanabilirsiniz.');
            break;
            
        case 'kelimefiltre':
        case 'wordfilter':
            if (!config.wordFilter) config.wordFilter = {};
            config.wordFilter.enabled = true;
            
            // Eylem belirtilmişse ayarla
            if (args.length > 0) {
                const action = args[0].toLowerCase();
                if (['delete', 'warn', 'mute', 'sil', 'uyar', 'sustur'].includes(action)) {
                    if (action === 'sil') config.wordFilter.action = 'delete';
                    else if (action === 'uyar') config.wordFilter.action = 'warn';
                    else if (action === 'sustur') config.wordFilter.action = 'mute';
                    else config.wordFilter.action = action;
                }
            }
            
            // Varsayılan eylem olarak silme belirle
            if (!config.wordFilter.action) config.wordFilter.action = 'delete';
            
            embed.setTitle(`${config.emojis.filter || '🧹'} Kelime Filtresi Aktif`)
                .setDescription(`Kelime filtresi \`${getActionText(config.wordFilter.action)}\` eylemiyle aktif edildi.`)
                .addField('İpucu', 'Yasaklı kelimeler eklemek için `.kelimefiltre ekle <kelime>` komutunu kullanabilirsiniz.');
            break;
        
        case 'emojifiltre':
        case 'emojifilter':
            if (!config.emojiFilter) config.emojiFilter = {};
            config.emojiFilter.enabled = true;
            
            // Eylem belirtilmişse ayarla
            if (args.length > 0) {
                const action = args[0].toLowerCase();
                if (['delete', 'warn', 'mute', 'sil', 'uyar', 'sustur'].includes(action)) {
                    if (action === 'sil') config.emojiFilter.action = 'delete';
                    else if (action === 'uyar') config.emojiFilter.action = 'warn';
                    else if (action === 'sustur') config.emojiFilter.action = 'mute';
                    else config.emojiFilter.action = action;
                }
            }
            
            // Emoji limiti belirtilmişse ayarla
            if (args.length > 1) {
                const maxEmojis = parseInt(args[1]);
                if (!isNaN(maxEmojis) && maxEmojis > 0) {
                    config.emojiFilter.maxEmojis = maxEmojis;
                }
            }
            
            // Varsayılan değerler
            if (!config.emojiFilter.action) config.emojiFilter.action = 'delete';
            if (!config.emojiFilter.maxEmojis) config.emojiFilter.maxEmojis = 5;
            
            embed.setTitle(`${config.emojis.emoji || '😀'} Emoji Filtresi Aktif`)
                .setDescription(`Emoji filtresi \`${getActionText(config.emojiFilter.action)}\` eylemiyle aktif edildi. Maksimum emoji sayısı: ${config.emojiFilter.maxEmojis}`)
                .addField('İpucu', 'Emoji limitini ve eylemini değiştirmek için `.emojifiltre aç [eylem] [maxEmoji]` komutunu kullanabilirsiniz.');
            break;
            
        default:
            configChanged = false;
            embed.setTitle(`${config.emojis.error} Bilinmeyen Özellik`)
                .setColor(config.embedColors.error)
                .setDescription(`\`${feature}\` isimli bir güvenlik özelliği bulunamadı.\n\nKullanılabilir özellikler: \`antibot\`, \`antilink\`, \`antispam\`, \`antiraid\`, \`hesapfiltre\`, \`kelimefiltre\`, \`emojifiltre\`, \`yetkikoruma\`, \`limit\``)
                .addField('İpucu', 'Tüm güvenlik özelliklerini görmek için `.güvenlik` komutunu kullanabilirsiniz.');
    }
    
    // Konfigürasyonu kaydet
    if (configChanged) {
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
            logger.info(`Security config updated by ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            logger.error(`Failed to save config: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Konfigürasyon dosyası kaydedilemedi!`)
                ]
            });
        }
    }
    
    return message.reply({ embeds: [embed] });
}

/**
 * Bir güvenlik özelliğini sıfırlar
 * @param {Message} message 
 * @param {Client} client 
 * @param {string} feature 
 * @param {Object} guildConfig 
 */
function resetSecurityFeature(message, client, feature, guildConfig) {
    // Konfigürasyonu güncelle
    let configChanged = true;
    const configPath = './config.json';
    let config;
    
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
        logger.error(`Failed to read config: ${error.message}`);
        return message.reply({
            embeds: [new MessageEmbed()
                .setColor(config.embedColors.error)
                .setDescription(`${config.emojis.error} Konfigürasyon dosyası okunamadı!`)
            ]
        });
    }
    
    const embed = new MessageEmbed()
        .setColor(config.embedColors.success)
        .setTimestamp();
    
    switch (feature) {
        case 'antibot':
        case 'botfiltre':
            if (config.antiBot) {
                config.antiBot.enabled = false;
            }
            embed.setTitle(`${config.emojis.bot || '🤖'} Bot Koruma Devre Dışı`)
                .setDescription('Bot koruma sistemi devre dışı bırakıldı.');
            break;
            
        case 'antilink':
        case 'linkkoruma':
            if (config.antiLink) {
                config.antiLink.enabled = false;
            }
            embed.setTitle(`${config.emojis.link || '🔗'} Link Koruma Devre Dışı`)
                .setDescription('Link koruma sistemi devre dışı bırakıldı.');
            break;
            
        case 'antispam':
        case 'spamkoruma':
            if (config.antiSpam) {
                config.antiSpam.enabled = false;
            }
            embed.setTitle(`${config.emojis.spam || '🔄'} Spam Koruma Devre Dışı`)
                .setDescription('Spam koruma sistemi devre dışı bırakıldı.');
            break;
            
        case 'antiraid':
        case 'baskınkoruma':
            if (config.antiRaid) {
                config.antiRaid.enabled = false;
            }
            embed.setTitle(`${config.emojis.raid || '🚨'} Baskın Koruma Devre Dışı`)
                .setDescription('Baskın koruma sistemi devre dışı bırakıldı.');
            break;
            
        case 'hesapfiltre':
        case 'hesap':
        case 'newaccount':
            if (config.newAccountFilter) {
                config.newAccountFilter.enabled = false;
            }
            embed.setTitle(`${config.emojis.account || '👤'} Hesap Filtresi Devre Dışı`)
                .setDescription('Hesap filtresi devre dışı bırakıldı.');
            break;
            
        case 'yetkikoruma':
        case 'permguard':
            if (config.permGuard) {
                config.permGuard.enabled = false;
            }
            embed.setTitle(`${config.emojis.security || '🔐'} Yetki Koruma Devre Dışı`)
                .setDescription('Yetki koruma sistemi devre dışı bırakıldı.');
            break;
            
        case 'limit':
        case 'limits':
        case 'limitler':
            if (config.limits) {
                config.limits.enabled = false;
            }
            embed.setTitle(`${config.emojis.limit || '⚠️'} İşlem Limitleri Devre Dışı`)
                .setDescription('İşlem limitleri devre dışı bırakıldı.');
            break;
            
        case 'kelimefiltre':
        case 'wordfilter':
            if (config.wordFilter) {
                config.wordFilter.enabled = false;
            }
            embed.setTitle(`${config.emojis.filter || '🧹'} Kelime Filtresi Devre Dışı`)
                .setDescription('Kelime filtresi devre dışı bırakıldı.');
            break;
        
        case 'emojifiltre':
        case 'emojifilter':
            if (config.emojiFilter) {
                config.emojiFilter.enabled = false;
            }
            embed.setTitle(`${config.emojis.emoji || '😀'} Emoji Filtresi Devre Dışı`)
                .setDescription('Emoji filtresi devre dışı bırakıldı.');
            break;
            
        default:
            configChanged = false;
            embed.setTitle(`${config.emojis.error} Bilinmeyen Özellik`)
                .setColor(config.embedColors.error)
                .setDescription(`\`${feature}\` isimli bir güvenlik özelliği bulunamadı.\n\nKullanılabilir özellikler: \`antibot\`, \`antilink\`, \`antispam\`, \`antiraid\`, \`hesapfiltre\`, \`kelimefiltre\`, \`emojifiltre\`, \`yetkikoruma\`, \`limit\``)
                .addField('İpucu', 'Tüm güvenlik özelliklerini görmek için `.güvenlik` komutunu kullanabilirsiniz.');
    }
    
    // Konfigürasyonu kaydet
    if (configChanged) {
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf-8');
            logger.info(`Security config reset by ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            logger.error(`Failed to save config: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Konfigürasyon dosyası kaydedilemedi!`)
                ]
            });
        }
    }
    
    return message.reply({ embeds: [embed] });
}

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