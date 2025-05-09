const { GuildBan, Client } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'guildBanAdd',
    /**
     * @param {GuildBan} ban
     * @param {Client} client 
     */
    async execute(ban, client) {
        try {
            const { guild, user } = ban;
            logger.debug(`Kullanıcı yasaklandı: ${user.tag} (${user.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see who banned the user
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: 22 // AuditLogEvent.MEMBER_BAN_ADD
            }).catch(error => {
                logger.error(`Ban audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const banLog = auditLogs.entries.first();
            if (!banLog) return;
            
            const { executor } = banLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check ban limit
            limits.checkBanLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Ban event hatası: ${error.message}`);
        }
    }
};