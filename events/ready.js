const { Client } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * @param {Client} client 
     */
    async execute(client) {
        logger.info(`Bot logged in as ${client.user.tag}!`);
        
        // Set bot activity
        client.user.setActivity(`.help | Protecting ${client.guilds.cache.size} servers`, { type: 'WATCHING' });
        
        // Log some stats
        logger.info(`Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);
        
        // Setup guilds (create necessary roles, channels, etc.)
        await setupGuilds(client);
        
        // Check for expired mutes every minute
        setInterval(() => {
            checkExpiredMutes(client);
        }, 60000); // every minute
        
        // Update activity every hour
        setInterval(() => {
            client.user.setActivity(`.help | Protecting ${client.guilds.cache.size} servers`, { type: 'WATCHING' });
        }, 3600000); // every hour
    }
};

/**
 * Setup guilds - create necessary roles and channels for security features
 * @param {Client} client 
 */
async function setupGuilds(client) {
    logger.info('Setting up guilds...');
    
    for (const guild of client.guilds.cache.values()) {
        try {
            logger.info(`Setting up guild: ${guild.name}`);
            
            // Create or find mute role
            let muteRole = guild.roles.cache.get(client.config.muteRole) || 
                          guild.roles.cache.find(role => 
                            role.name.toLowerCase() === 'muted' || 
                            role.name.toLowerCase() === 'susturulmuş');
            
            // If mute role doesn't exist, create it
            if (!muteRole) {
                logger.info(`Creating mute role in ${guild.name}`);
                try {
                    muteRole = await guild.roles.create({
                        name: 'Muted',
                        color: '#666666',
                        reason: 'Auto-created for moderation'
                    });
                    
                    // Update config
                    client.config.muteRole = muteRole.id;
                    
                    // Setup permissions for all channels
                    for (const channel of guild.channels.cache.values()) {
                        if (channel.type === 'GUILD_TEXT' || channel.type === 0) {
                            await channel.permissionOverwrites.create(muteRole, {
                                SEND_MESSAGES: false,
                                ADD_REACTIONS: false
                            }).catch(e => logger.error(`Failed to setup perms in ${channel.name}: ${e.message}`));
                        } 
                        else if (channel.type === 'GUILD_VOICE' || channel.type === 2) {
                            await channel.permissionOverwrites.create(muteRole, {
                                SPEAK: false,
                                STREAM: false
                            }).catch(e => logger.error(`Failed to setup perms in ${channel.name}: ${e.message}`));
                        }
                    }
                    
                    logger.info(`Mute role created in ${guild.name}`);
                } catch (error) {
                    logger.error(`Failed to create mute role in ${guild.name}: ${error.message}`);
                }
            }
            
            // Create or find log channel
            let logChannel = guild.channels.cache.get(client.config.logChannel) ||
                          guild.channels.cache.find(channel => 
                            channel.name.toLowerCase() === 'mod-logs' || 
                            channel.name.toLowerCase() === 'security-logs' ||
                            channel.name.toLowerCase() === 'logs');
            
            // If log channel doesn't exist, create it
            if (!logChannel) {
                logger.info(`Creating log channel in ${guild.name}`);
                try {
                    logChannel = await guild.channels.create('security-logs', {
                        type: 'GUILD_TEXT',
                        topic: 'Security and moderation logs',
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: ['VIEW_CHANNEL']
                            },
                            {
                                id: client.user.id,
                                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS']
                            }
                        ]
                    });
                    
                    // Update config
                    client.config.logChannel = logChannel.id;
                    
                    // Send test message
                    await logChannel.send({
                        embeds: [{
                            color: client.config.embedColors.info,
                            title: `${client.config.emojis.info} Log Channel Setup`,
                            description: 'This channel has been automatically created for security and moderation logs.',
                            fields: [
                                { name: 'Configured By', value: client.user.tag, inline: true },
                                { name: 'Time', value: new Date().toLocaleString(), inline: true }
                            ],
                            footer: { text: 'Astro Bot Security System' },
                            timestamp: new Date()
                        }]
                    });
                    
                    logger.info(`Log channel created in ${guild.name}`);
                } catch (error) {
                    logger.error(`Failed to create log channel in ${guild.name}: ${error.message}`);
                }
            }
            
            // Save the config
            try {
                const fs = require('fs');
                fs.writeFileSync('./config.json', JSON.stringify(client.config, null, 4));
                logger.info(`Config updated for guild ${guild.name}`);
            } catch (error) {
                logger.error(`Failed to save config: ${error.message}`);
            }
            
        } catch (error) {
            logger.error(`Failed to setup guild ${guild.name}: ${error.message}`);
        }
    }
    
    logger.info('Guild setup complete!');
}

/**
 * Check and remove expired mutes
 * @param {Client} client 
 */
async function checkExpiredMutes(client) {
    const expiredMutes = database.getExpiredMutes();
    
    for (const { guildId, userId, mute } of expiredMutes) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            
            const muteRole = guild.roles.cache.get(client.config.muteRole) || 
                guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
            
            if (!muteRole) continue;
            
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) {
                // Remove from database as we can't find the member
                database.removeMute(guildId, userId);
                continue;
            }
            
            // Remove mute role
            await member.roles.remove(muteRole);
            
            // Remove from database
            database.removeMute(guildId, userId);
            
            // Log unmute
            logger.moderation('UNMUTE (AUTO)', client.user.tag, member.user.tag, 'Mute duration expired');
            
            // Send message in log channel
            const logChannel = guild.channels.cache.get(client.config.logChannel);
            if (logChannel) {
                const emoji = client.config.emojis.unmute;
                logChannel.send({
                    embeds: [{
                        color: client.config.embedColors.success,
                        title: `${emoji} Auto Unmute`,
                        description: `**${member.user.tag}** has been automatically unmuted.`,
                        fields: [
                            { name: 'User', value: `<@${member.user.id}>`, inline: true },
                            { name: 'User ID', value: member.user.id, inline: true },
                            { name: 'Reason', value: 'Mute duration expired' }
                        ],
                        timestamp: new Date()
                    }]
                });
            }
        } catch (error) {
            logger.error(`Failed to process expired mute: ${error.message}`);
        }
    }
}
