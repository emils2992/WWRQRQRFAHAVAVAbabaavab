const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const antiSpam = require('../security/antiSpam');
const antiLink = require('../security/antiLink');
const limits = require('../security/limits');
const wordFilter = require('../security/wordFilter');
const emojiFilter = require('../security/emojiFilter');

module.exports = {
    name: 'messageCreate',
    /**
     * @param {Message} message 
     * @param {Client} client 
     */
    async execute(message, client) {
        // Ignore messages from bots
        if (message.author.bot) return;
        
        // Ignore DM messages
        if (!message.guild) return;
        
        // Güvenlik sistemi kontrolleri
        try {
            // Özel debug modu - gelişmiş loglar
            const isDeveloper = message.author.id === message.guild.ownerId; // Geliştirme için
            
            // Anti-spam kontrolü
            if (config.antiSpam && config.antiSpam.enabled) {
                logger.info(`Anti-spam kontrol ediliyor: ${message.author.tag} - Mesaj: ${message.content.substring(0, 30)}`);
                // Adminleri kontrol et - mesaj modüllerinde rol hiyerarşisi önemli değil
                if (!message.member.permissions.has('ADMINISTRATOR')) {
                    const spamDetected = antiSpam.checkMessage(message);
                    if (spamDetected) {
                        logger.security('SPAM', `${message.author.tag} tarafından spam tespit edildi`);
                        return;
                    }
                } else {
                    logger.info(`Anti-spam atlandı: ${message.author.tag} (administrator yetkileri var)`);
                }
            }
            
            // Anti-link kontrolü
            if (config.antiLink && config.antiLink.enabled) {
                logger.info(`Anti-link kontrol ediliyor: ${message.content.substring(0, 30)}`);
                
                // URL tespit için basit kontrol
                const hasLink = message.content.includes('http') || 
                                message.content.includes('www.') ||
                                message.content.includes('.com') ||
                                message.content.includes('.net') ||
                                message.content.includes('.org') ||
                                message.content.includes('discord.gg');
                
                if (hasLink) {
                    logger.info(`Link içeriği tespit edildi: ${message.content}`);
                    
                    // Adminleri kontrol et - mesaj modüllerinde rol hiyerarşisi önemli değil
                    if (!message.member.permissions.has('ADMINISTRATOR')) {
                        const linkDetected = antiLink.checkMessage(message);
                        if (linkDetected) {
                            logger.security('LINK', `${message.author.tag} tarafından yasak link paylaşıldı`);
                            return;
                        }
                    } else {
                        logger.info(`Anti-link atlandı: ${message.author.tag} (administrator yetkileri var)`);
                    }
                }
            }
            
            // Toplu etiket kontrolü
            const hasMassMention = message.mentions.users.size >= 3 || message.mentions.roles.size >= 2 || message.mentions.everyone;
            if (config.limits && config.limits.enabled && hasMassMention) {
                logger.debug(`Toplu etiket kontrol ediliyor: ${message.author.tag}`);
                const limitReached = limits.checkMassTagLimit(message.guild, message.author.id);
                if (limitReached) {
                    logger.security('MASS_TAG', `${message.author.tag} toplu etiket limiti aşıldı`);
                    return;
                }
            }
            
            // Yasaklı kelime kontrolü
            if (config.wordFilter && config.wordFilter.enabled) {
                logger.debug(`Kelime filtresi kontrol ediliyor: ${message.author.tag}`);
                const badWordDetected = wordFilter.checkMessage(message);
                if (badWordDetected) {
                    logger.security('YASAK_KELIME', `${message.author.tag} tarafından yasaklı kelime kullanıldı`);
                    return;
                }
            }
            
            // Emoji filtresi kontrolü
            if (config.emojiFilter && config.emojiFilter.enabled) {
                logger.debug(`Emoji filtresi kontrol ediliyor: ${message.author.tag}`);
                const emojiLimitExceeded = emojiFilter.checkMessage(message);
                if (emojiLimitExceeded) {
                    logger.security('EMOJI_LIMIT', `${message.author.tag} emoji limitini aştı`);
                    return;
                }
            }
        } catch (error) {
            logger.error(`Güvenlik kontrol hatası: ${error.message}`);
        }
        
        // Check if message starts with prefix
        const prefix = config.prefix;
        if (!message.content.startsWith(prefix)) return;
        
        // Parse command and arguments
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Get command from collection
        const command = client.commands.get(commandName) || 
                       client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        
        // If command doesn't exist, return
        if (!command) return;
        
        // Check if command should be run in guild only
        if (command.guildOnly && !message.guild) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu komut sadece sunucularda kullanılabilir!`)
                ]
            });
        }
        
        // Check if args are required
        if (command.args && args.length < command.argsCount) {
            let reply = `${config.emojis.error} Doğru argümanları belirtmediniz!`;
            
            if (command.usage) {
                reply += `\nDoğru kullanım: \`${prefix}${command.name} ${command.usage}\``;
            }
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(reply)
                ]
            });
        }
        
        // Check user permissions
        const { checkPermissions, botHasPermissions, getMissingPermissions } = require('../utils/permissions');
        
        if (command.permissions && !checkPermissions(message.member, command.permissions)) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu komutu kullanmak için yeterli yetkiye sahip değilsiniz!`)
                ]
            });
        }
        
        // Check bot permissions
        if (command.botPermissions && !botHasPermissions(message.channel, command.botPermissions)) {
            const missingPermissions = getMissingPermissions(message.channel, command.botPermissions);
            
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu komutu çalıştırmak için şu yetkilere ihtiyacım var: ${missingPermissions.join(', ')}`)
                ]
            });
        }
        
        // Cooldowns
        const { Collection } = require('discord.js');
        
        if (!client.cooldowns.has(command.name)) {
            client.cooldowns.set(command.name, new Collection());
        }
        
        const now = Date.now();
        const timestamps = client.cooldowns.get(command.name);
        const cooldownAmount = (command.cooldown || 3) * 1000;
        
        if (timestamps.has(message.author.id)) {
            const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Lütfen \`${command.name}\` komutunu tekrar kullanmadan önce ${timeLeft.toFixed(1)} saniye bekleyin.`)
                    ]
                });
            }
        }
        
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        
        // Execute command
        try {
            await command.execute(message, args, client);
            logger.info(`Command executed: ${command.name} by ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            logger.error(`Command error: ${command.name} - ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu komut çalıştırılırken bir hata oluştu!`)
                ]
            });
        }
    }
};
