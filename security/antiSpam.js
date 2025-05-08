const { Collection, Message, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const database = require('../utils/database');

// Collection to store user messages
const usersMap = new Collection();

module.exports = {
    /**
     * Initialize anti-spam module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-spam module initialized');
        
        // Check expired timeouts every minute
        setInterval(() => {
            const now = Date.now();
            usersMap.sweep((userData) => now > userData.lastMessage + 30000);
        }, 60000);
    },
    
    /**
     * Check message for spam
     * @param {Message} message 
     * @returns {boolean} Whether spam was detected
     */
    checkMessage(message) {
        // If anti-spam is disabled, return
        if (!config.antiSpam.enabled) return false;
        
        // Ignore bot messages
        if (message.author.bot) return false;
        
        // Get anti-spam config
        const LIMIT = config.antiSpam.maxMessages;
        const TIME = config.antiSpam.timeWindow;
        const DIFF = config.antiSpam.timeWindow;
        
        // Ignore if user has MANAGE_MESSAGES permission
        if (message.member.permissions.has('MANAGE_MESSAGES')) return false;
        
        // Get user data from collection
        const userData = usersMap.get(message.author.id);
        
        // If user doesn't exist in the collection
        if (!userData) {
            usersMap.set(message.author.id, {
                messages: 1,
                lastMessage: Date.now(),
                timer: null
            });
            return false;
        }
        
        // Check time difference between messages
        if (Date.now() - userData.lastMessage > DIFF) {
            // Reset user data if time difference is greater than the limit
            clearTimeout(userData.timer);
            userData.messages = 1;
            userData.lastMessage = Date.now();
            
            // Set timer to reset user data after time period
            userData.timer = setTimeout(() => {
                usersMap.delete(message.author.id);
            }, TIME);
            
            usersMap.set(message.author.id, userData);
            return false;
        }
        
        // Increment message count
        userData.messages++;
        
        // Check if user has exceeded the message limit
        if (userData.messages >= LIMIT) {
            // Take action for spam
            this.takeAction(message);
            return true;
        }
        
        // Update user data in collection
        usersMap.set(message.author.id, userData);
        return false;
    },
    
    /**
     * Take action against spammer
     * @param {Message} message 
     */
    async takeAction(message) {
        // Log spam detection
        logger.security('SPAM_DETECTED', `User ${message.author.tag} detected for spamming in ${message.guild.name}`);
        
        try {
            // Delete recent messages from the user
            const messages = await message.channel.messages.fetch({ limit: 10 });
            const userMessages = messages.filter(m => m.author.id === message.author.id);
            
            if (userMessages.size > 0) {
                message.channel.bulkDelete(userMessages);
            }
            
            // Get mute role
            const muteRole = message.guild.roles.cache.get(config.muteRole) || 
                            message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
            
            // If mute role doesn't exist, try to create it
            if (!muteRole) {
                // Send a warning
                message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} Spam detected from <@${message.author.id}>. Please configure a mute role for automatic muting.`)
                    ]
                });
                
                return;
            }
            
            // Add mute role
            await message.member.roles.add(muteRole);
            
            // Add mute to database with duration
            const muteTime = config.antiSpam.muteTime * 60 * 1000; // Convert minutes to ms
            database.addMute(message.guild.id, message.author.id, message.client.user.id, 'Automatic mute for spamming', muteTime);
            
            // Send notification in channel
            message.channel.send({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.warning)
                    .setDescription(`${config.emojis.mute} <@${message.author.id}> has been muted for ${config.antiSpam.muteTime} minutes for spamming.`)
                ]
            });
            
            // Send DM to user
            try {
                await message.author.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} You have been muted in ${message.guild.name}`)
                        .setDescription(`You have been automatically muted for ${config.antiSpam.muteTime} minutes due to spamming.`)
                        .setFooter({ text: 'Please respect the server rules and avoid spamming in the future.' })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Ignore if user has DMs closed
            }
            
            // Send log to log channel
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} Auto-Mute for Spam`)
                        .setDescription(`**${message.author.tag}** has been automatically muted for spamming.`)
                        .addFields(
                            { name: 'User', value: `<@${message.author.id}>`, inline: true },
                            { name: 'User ID', value: message.author.id, inline: true },
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Duration', value: `${config.antiSpam.muteTime} minutes`, inline: true }
                        )
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
            
            // Reset user in usersMap
            usersMap.delete(message.author.id);
            
        } catch (error) {
            logger.error(`Anti-spam action error: ${error.message}`);
        }
    }
};
