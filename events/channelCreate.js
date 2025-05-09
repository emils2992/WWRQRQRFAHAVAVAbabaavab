const { GuildChannel, Client } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'channelCreate',
    /**
     * @param {GuildChannel} channel 
     * @param {Client} client 
     */
    async execute(channel, client) {
        try {
            // Only process guild channels
            if (!channel.guild) return;
            
            const { guild } = channel;
            logger.debug(`Kanal oluşturuldu: ${channel.name} (${channel.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see who created the channel
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: 10 // AuditLogEvent.CHANNEL_CREATE
            }).catch(error => {
                logger.error(`Kanal oluşturma audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const channelLog = auditLogs.entries.first();
            if (!channelLog) return;
            
            const { executor } = channelLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check channel creation limit
            limits.checkChannelCreateLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Channel create event hatası: ${error.message}`);
        }
    }
};