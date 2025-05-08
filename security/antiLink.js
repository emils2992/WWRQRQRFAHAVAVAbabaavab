const { Collection, Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// URL regex pattern
const URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,}|discord\.gg\/[a-zA-Z0-9]+)/i;

// Collection for cooldowns
const warnedUsers = new Collection();

module.exports = {
    /**
     * Initialize anti-link module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-link module initialized');
        
        // Clean up warned users every 30 minutes
        setInterval(() => {
            const now = Date.now();
            warnedUsers.sweep(timestamp => now - timestamp > 1800000); // 30 minutes
        }, 1800000);
    },
    
    /**
     * Check message for links
     * @param {Message} message 
     * @returns {boolean} Whether links were detected and action was taken
     */
    checkMessage(message) {
        // Skip if anti-link is disabled
        if (!config.antiLink || !config.antiLink.enabled) return false;
        
        // Ignore bot messages
        if (message.author.bot) return false;
        
        // Check if message contains a link
        if (!URL_REGEX.test(message.content)) return false;
        
        // Ignore users with permission to post links
        if (message.member.permissions.has('MANAGE_MESSAGES') || 
            message.member.permissions.has('ADMINISTRATOR')) {
            return false;
        }
        
        // Check if the user is whitelisted in the channel
        const guildConfig = database.getGuildConfig(message.guild.id);
        const allowedChannels = (guildConfig.linkAllowedChannels || []);
        
        if (allowedChannels.includes(message.channel.id)) {
            return false;
        }
        
        // Check action type
        const action = config.antiLink.action || 'delete';
        
        // Take action based on config
        this.takeAction(message, action);
        return true;
    },
    
    /**
     * Take action against link poster
     * @param {Message} message 
     * @param {string} action - The action to take (delete, warn, mute)
     */
    async takeAction(message, action) {
        logger.security('LINK_DETECTED', `Link detected from ${message.author.tag} in ${message.guild.name}`);
        
        try {
            // Delete the message
            await message.delete();
            
            // If this is the first offense in the last 30 minutes, just warn
            if (!warnedUsers.has(message.author.id)) {
                warnedUsers.set(message.author.id, Date.now());
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşmak bu kanalda yasaktır!`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                return;
            }
            
            // For repeated offenses, take the specified action
            if (action === 'warn') {
                // Add warning to database
                const reason = 'Link paylaşımı yasaktır';
                database.addWarning(message.guild.id, message.author.id, message.client.user.id, reason);
                
                // Send warning message
                const warningMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} <@${message.author.id}>, link paylaşımından dolayı uyarıldınız!`)
                    ]
                });
                
                // Delete warning after 5 seconds
                setTimeout(() => {
                    warningMsg.delete().catch(() => {});
                }, 5000);
                
                // Send log to log channel
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.warning} Link Uyarısı`)
                            .setDescription(`**${message.author.tag}** link paylaşmaktan dolayı uyarıldı.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Link içeriği', value: `\`\`\`${message.content.slice(0, 900)}\`\`\`` }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            } else if (action === 'mute') {
                // Get mute role
                const muteRole = message.guild.roles.cache.get(config.muteRole) || 
                                message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'susturulmuş');
                
                if (!muteRole) {
                    logger.error('Failed to mute user for link posting: no mute role found');
                    return;
                }
                
                // Add mute role
                await message.member.roles.add(muteRole);
                
                // Get mute duration from config (default: 10 minutes)
                const muteDuration = (config.antiLink.muteDuration || 10) * 60 * 1000;
                
                // Add mute to database
                database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Link paylaşımı yasaktır', muteDuration);
                
                // Send mute message
                const muteMsg = await message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.mute} <@${message.author.id}>, link paylaşımından dolayı ${config.antiLink.muteDuration || 10} dakika susturuldunuz!`)
                    ]
                });
                
                // Delete mute message after 5 seconds
                setTimeout(() => {
                    muteMsg.delete().catch(() => {});
                }, 5000);
                
                // Send log to log channel
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel) {
                    logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.mute} Link Paylaşımı Susturması`)
                            .setDescription(`**${message.author.tag}** link paylaşmaktan dolayı susturuldu.`)
                            .addFields(
                                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Süre', value: `${config.antiLink.muteDuration || 10} dakika`, inline: true },
                                { name: 'Link içeriği', value: `\`\`\`${message.content.slice(0, 900)}\`\`\`` }
                            )
                            .setTimestamp()
                        ]
                    });
                }
            }
        } catch (error) {
            logger.error(`Anti-link action error: ${error.message}`);
        }
    }
};