const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'clear',
    description: 'Clear a specified number of messages',
    usage: '<amount> [user]',
    aliases: ['purge', 'prune'],
    args: true,
    argsCount: 1,
    guildOnly: true,
    permissions: [Permissions.FLAGS.MANAGE_MESSAGES],
    botPermissions: [Permissions.FLAGS.MANAGE_MESSAGES],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Parse amount
        const amount = parseInt(args[0]);
        
        // Validate amount
        if (isNaN(amount)) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Please provide a valid number of messages to clear!`)
                ]
            });
        }
        
        if (amount < 1 || amount > 100) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Please provide a number between 1 and 100!`)
                ]
            });
        }
        
        try {
            // Delete the command message
            await message.delete();
            
            // Get user if specified
            let targetUser = null;
            if (args[1]) {
                const target = message.mentions.members.first() || 
                              await message.guild.members.fetch(args[1]).catch(() => null);
                
                if (target) {
                    targetUser = target.user;
                }
            }
            
            // Fetch messages
            const messages = await message.channel.messages.fetch({ limit: 100 });
            
            // Filter messages
            let filteredMessages;
            
            if (targetUser) {
                filteredMessages = messages.filter(m => m.author.id === targetUser.id).first(amount);
            } else {
                filteredMessages = messages.first(amount);
            }
            
            // Delete messages
            await message.channel.bulkDelete(filteredMessages);
            
            // Log the action
            const target = targetUser ? `from ${targetUser.tag}` : '';
            logger.moderation('CLEAR', message.author.tag, message.channel.name, `${filteredMessages.length} messages ${target}`);
            
            // Send confirmation
            const confirmationEmbed = new MessageEmbed()
                .setColor(config.embedColors.success)
                .setDescription(`${config.emojis.clear} ${filteredMessages.length} messages ${targetUser ? `from **${targetUser.tag}**` : ''} have been deleted!`);
            
            const confirmMessage = await message.channel.send({ embeds: [confirmationEmbed] });
            
            // Delete confirmation after 5 seconds
            setTimeout(() => {
                confirmMessage.delete().catch(() => {});
            }, 5000);
            
            // Send log to log channel
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.info)
                        .setTitle(`${config.emojis.clear} Messages Cleared`)
                        .setDescription(`${filteredMessages.length} messages have been cleared ${targetUser ? `from **${targetUser.tag}**` : ''} in ${message.channel}.`)
                        .addFields(
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Moderator', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Amount', value: filteredMessages.length.toString(), inline: true },
                            targetUser ? { name: 'Target User', value: `<@${targetUser.id}>`, inline: true } : null
                        ).filter(Boolean)
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            // Check if error is about messages older than 14 days
            if (error.code === 50034) {
                message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} I can't delete messages older than 14 days!`)
                    ]
                }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            } else {
                logger.error(`Clear command error: ${error.message}`);
                message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} There was an error clearing messages!`)
                    ]
                }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            }
        }
    }
};
