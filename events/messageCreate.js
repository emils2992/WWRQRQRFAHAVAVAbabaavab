const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const antiSpam = require('../security/antiSpam');
const antiLink = require('../security/antiLink');
const limits = require('../security/limits');

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
        
        // Anti-spam check
        if (config.antiSpam && config.antiSpam.enabled) {
            const spamDetected = antiSpam.checkMessage(message);
            if (spamDetected) return;
        }
        
        // Anti-link check
        if (config.antiLink && config.antiLink.enabled) {
            const linkDetected = antiLink.checkMessage(message);
            if (linkDetected) return;
        }
        
        // Toplu etiket kontrolü
        if (config.limits && config.limits.enabled && message.mentions.everyone) {
            const { checkMassTagLimit } = limits;
            const limitReached = checkMassTagLimit(message.guild, message.author.id);
            if (limitReached) return;
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
