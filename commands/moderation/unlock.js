const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'unlock',
    description: 'Unlock a previously locked channel',
    usage: '[channel] [reason]',
    aliases: ['unlockdown'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.MANAGE_CHANNELS],
    botPermissions: [Permissions.FLAGS.MANAGE_CHANNELS],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Get channel (mentioned, by ID, or current)
        const channel = message.mentions.channels.first() || 
                       message.guild.channels.cache.get(args[0]) || 
                       message.channel;
        
        // Check if channel is a text channel
        if (channel.type !== 'GUILD_TEXT') {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} I can only unlock text channels!`)
                ]
            });
        }
        
        // Get reason
        const reason = args.join(' ') || 'No reason provided';
        
        try {
            // Unlock the channel by allowing SEND_MESSAGES permission for @everyone role
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SEND_MESSAGES: null // Reset to default
            });
            
            // Log the action
            logger.moderation('UNLOCK', message.author.tag, channel.name, reason);
            
            // Send confirmation to the channel
            channel.send({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setTitle(`${config.emojis.unlock} Channel Unlocked`)
                    .setDescription(`This channel has been unlocked by a moderator.`)
                    .addField('Reason', reason)
                    .setFooter({ text: `Unlocked by ${message.author.tag}` })
                    .setTimestamp()
                ]
            });
            
            // If channel is not the same as command channel, send confirmation
            if (channel.id !== message.channel.id) {
                message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.unlock} **${channel.name}** has been unlocked!\n**Reason:** ${reason}`)
                    ]
                });
            }
            
            // Send log to log channel
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel && logChannel.id !== channel.id) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setTitle(`${config.emojis.unlock} Channel Unlocked`)
                        .setDescription(`**${channel.name}** has been unlocked.`)
                        .addFields(
                            { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                            { name: 'Moderator', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            logger.error(`Unlock command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} There was an error unlocking that channel!`)
                ]
            });
        }
    }
};
