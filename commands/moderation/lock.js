const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'lock',
    description: 'Lock a channel to prevent users from sending messages',
    usage: '[channel] [reason]',
    aliases: ['lockdown'],
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
        
        // Check if channel can be locked (is a text channel)
        if (channel.type !== 'GUILD_TEXT') {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} I can only lock text channels!`)
                ]
            });
        }
        
        // Get reason
        const reason = args.join(' ') || 'No reason provided';
        
        try {
            // Lock the channel by denying SEND_MESSAGES permission for @everyone role
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SEND_MESSAGES: false
            });
            
            // Log the action
            logger.moderation('LOCK', message.author.tag, channel.name, reason);
            
            // Send confirmation to the channel
            channel.send({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.warning)
                    .setTitle(`${config.emojis.lock} Channel Locked`)
                    .setDescription(`This channel has been locked by a moderator.`)
                    .addField('Reason', reason)
                    .setFooter({ text: `Locked by ${message.author.tag}` })
                    .setTimestamp()
                ]
            });
            
            // If channel is not the same as command channel, send confirmation
            if (channel.id !== message.channel.id) {
                message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.lock} **${channel.name}** has been locked!\n**Reason:** ${reason}`)
                    ]
                });
            }
            
            // Send log to log channel
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel && logChannel.id !== channel.id) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.lock} Channel Locked`)
                        .setDescription(`**${channel.name}** has been locked.`)
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
            logger.error(`Lock command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} There was an error locking that channel!`)
                ]
            });
        }
    }
};
