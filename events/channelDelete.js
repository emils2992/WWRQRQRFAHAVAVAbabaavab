const { GuildChannel, Client } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'channelDelete',
    /**
     * @param {GuildChannel} channel 
     * @param {Client} client 
     */
    async execute(channel, client) {
        try {
            // Only process guild channels
            if (!channel.guild) return;
            
            const { guild } = channel;
            logger.debug(`Kanal silindi: ${channel.name} (${channel.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see who deleted the channel
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: 12 // AuditLogEvent.CHANNEL_DELETE
            }).catch(error => {
                logger.error(`Kanal silme audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const channelLog = auditLogs.entries.first();
            if (!channelLog) return;
            
            const { executor } = channelLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check channel deletion limit
            limits.checkChannelDeleteLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Channel delete event hatası: ${error.message}`);
        }
    }
};