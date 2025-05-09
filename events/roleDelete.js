const { Role, Client, AuditLogEvent } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'roleDelete',
    /**
     * @param {Role} role 
     * @param {Client} client 
     */
    async execute(role, client) {
        try {
            const { guild } = role;
            logger.debug(`Rol silindi: ${role.name} (${role.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see who deleted the role
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.RoleDelete
            }).catch(error => {
                logger.error(`Rol silme audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const roleLog = auditLogs.entries.first();
            if (!roleLog) return;
            
            const { executor } = roleLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check role deletion limit
            limits.checkRoleDeleteLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Role delete event hatası: ${error.message}`);
        }
    }
};