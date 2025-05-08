const { Client } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * @param {Client} client 
     */
    execute(client) {
        logger.info(`Bot logged in as ${client.user.tag}!`);
        
        // Set bot activity
        client.user.setActivity(`.help | Protecting ${client.guilds.cache.size} servers`, { type: 'WATCHING' });
        
        // Log some stats
        logger.info(`Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);
        
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
