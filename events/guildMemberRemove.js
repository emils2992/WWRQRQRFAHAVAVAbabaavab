const { GuildMember, Client } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'guildMemberRemove',
    /**
     * @param {GuildMember} member 
     * @param {Client} client 
     */
    async execute(member, client) {
        try {
            const { guild, user } = member;
            logger.debug(`Kullanıcı ayrıldı: ${user.tag} (${user.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see if this was a kick
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: 20 // AuditLogEvent.MEMBER_KICK
            }).catch(error => {
                logger.error(`Kick audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const kickLog = auditLogs.entries.first();
            if (!kickLog) return;
            
            // Check if this audit log entry is for the current member
            if (kickLog.target.id !== user.id) return;
            
            // Check if this is a recent action (within last 5 seconds)
            const timeDiff = Date.now() - kickLog.createdTimestamp;
            if (timeDiff > 5000) return; // older than 5 seconds, not related to this event
            
            const { executor } = kickLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check kick limit
            limits.checkKickLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Member remove event hatası: ${error.message}`);
        }
    }
};