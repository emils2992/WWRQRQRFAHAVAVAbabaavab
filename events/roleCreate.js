const { Role, Client, AuditLogEvent } = require('discord.js');
const limits = require('../security/limits');
const logger = require('../utils/logger');

module.exports = {
    name: 'roleCreate',
    /**
     * @param {Role} role 
     * @param {Client} client 
     */
    async execute(role, client) {
        try {
            const { guild } = role;
            logger.debug(`Rol oluşturuldu: ${role.name} (${role.id}) -> ${guild.name}`);
            
            // Fetch audit logs to see who created the role
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.RoleCreate
            }).catch(error => {
                logger.error(`Rol oluşturma audit log alınırken hata: ${error.message}`);
                return null;
            });
            
            if (!auditLogs) return;
            
            const roleLog = auditLogs.entries.first();
            if (!roleLog) return;
            
            const { executor } = roleLog;
            
            // Skip if executor is the bot itself
            if (executor.id === client.user.id) return;
            
            // Check role creation limit
            limits.checkRoleCreateLimit(guild, executor.id);
            
        } catch (error) {
            logger.error(`Role create event hatası: ${error.message}`);
        }
    }
};