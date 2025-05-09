const { MessageEmbed, Guild, Role, GuildMember } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    /**
     * Initialize permission guard module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Permission guard module initialized');
    },
    
    /**
     * Check if role update should be prevented
     * @param {Role} oldRole - The role before update
     * @param {Role} newRole - The role after update
     * @returns {boolean} - Whether dangerous permissions were added
     */
    checkRoleUpdate(oldRole, newRole) {
        // Skip if permission guard is disabled
        if (!config.permGuard || !config.permGuard.enabled) return false;
        
        // Get protected permissions
        const protectedPerms = config.permGuard.protectedPermissions || [
            'ADMINISTRATOR',
            'BAN_MEMBERS',
            'KICK_MEMBERS',
            'MANAGE_CHANNELS',
            'MANAGE_GUILD',
            'MANAGE_ROLES',
            'MANAGE_WEBHOOKS'
        ];
        
        // Check if dangerous permissions were added
        const addedPerms = [];
        
        for (const perm of protectedPerms) {
            if (!oldRole.permissions.has(perm) && newRole.permissions.has(perm)) {
                addedPerms.push(perm);
            }
        }
        
        // If no dangerous permissions were added, allow
        if (addedPerms.length === 0) return false;
        
        // Check audit logs to see who made the change
        const guild = newRole.guild;
        
        // Handle dangerous permissions (this will check audit logs and verify if the updater has proper permissions)
        this.handleDangerousPerm(newRole.guild, newRole, addedPerms);
        return true;
    },
    
    /**
     * Check if role addition to member should be prevented
     * @param {GuildMember} member - The member
     * @param {Role} role - The role being added
     * @returns {boolean} - Whether this should be prevented
     */
    checkRoleAddition(member, role) {
        // Skip if permission guard is disabled
        if (!config.permGuard || !config.permGuard.enabled) return false;
        
        // Get protected permissions
        const protectedPerms = config.permGuard.protectedPermissions || [
            'ADMINISTRATOR',
            'BAN_MEMBERS',
            'KICK_MEMBERS',
            'MANAGE_CHANNELS',
            'MANAGE_GUILD',
            'MANAGE_ROLES',
            'MANAGE_WEBHOOKS'
        ];
        
        // Check if role has dangerous permissions
        const dangerousPerms = [];
        
        for (const perm of protectedPerms) {
            if (role.permissions.has(perm)) {
                dangerousPerms.push(perm);
            }
        }
        
        // If no dangerous permissions, allow
        if (dangerousPerms.length === 0) return false;
        
        // Check if member is owner, allow if so
        if (member.guild.ownerId === member.id) {
            return false;
        }
        
        // Check if member is in owners list, allow if so
        if (config.owners.includes(member.id)) {
            return false;
        }
        
        // YETKİ KORUMA SİSTEMİNDE ROL HİYERARŞİSİ GEÇERLİ DEĞİL
        // Administrator yetkisine sahip olsa bile güvenlik için rol yetki koruması uygulanır
        // Sadece sunucu sahibi ve bot sahibi atlanır
        
        // Handle dangerous permission
        this.handleDangerousRoleAddition(member.guild, member, role, dangerousPerms);
        return true;
    },
    
    /**
     * Handle dangerous permission being added to a role
     * @param {Guild} guild - The guild
     * @param {Role} role - The role with new permissions
     * @param {Array} permissions - Array of dangerous permissions added
     */
    async handleDangerousPerm(guild, role, permissions) {
        logger.security('DANGEROUS_PERM', `Role ${role.name} (${role.id}) in ${guild.name} had dangerous permissions added: ${permissions.join(', ')}`);
        
        try {
            // Get the person who updated the role
            const auditLogs = await guild.fetchAuditLogs({
                type: 'ROLE_UPDATE',
                limit: 1,
            });
            
            const roleUpdateLog = auditLogs.entries.first();
            let updater = null;
            
            if (roleUpdateLog && roleUpdateLog.target.id === role.id) {
                updater = roleUpdateLog.executor;
            }
            
            // Skip checks if no updater found (rare case)
            if (!updater) {
                // Reset permissions on the role without further checks
                await role.setPermissions(role.permissions.remove(permissions));
                return;
            }
            
            // If updater is owner or in the owners list, allow
            if (guild.ownerId === updater.id || config.owners.includes(updater.id)) {
                return;
            }
            
            // Get the member who did the update
            const updaterMember = await guild.members.fetch(updater.id).catch(() => null);
            if (!updaterMember) {
                // Reset permissions on the role if updater is not in the guild anymore
                await role.setPermissions(role.permissions.remove(permissions));
                return;
            }
            
            // YETKİ KORUMA SİSTEMİNDE ROL HİYERARŞİSİ GEÇERLİ DEĞİL
            // Administrator yetkisine sahip olsa bile güvenlik için rol yetki koruması uygulanır
            // Sadece sunucu sahibi ve bot sahibi atlanır
            
            // Reset permissions on the role
            await role.setPermissions(role.permissions.remove(permissions));
            
            // Send log to log channel
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setTitle(`${config.emojis.security} Tehlikeli Yetki Engellendi`)
                    .setDescription(`**${role.name}** rolüne tehlikeli yetkiler eklenmeye çalışıldı ve engellendi.`)
                    .addFields(
                        { name: 'Rol', value: `${role.name} (${role.id})`, inline: true },
                        { name: 'Yasaklanan Yetkiler', value: permissions.join(', '), inline: true }
                    )
                    .setTimestamp();
                
                if (updater) {
                    embed.addField('Güncelleyen', `${updater.tag} (${updater.id})`, true);
                }
                
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error(`Error handling dangerous permission: ${error.message}`);
        }
    },
    
    /**
     * Handle dangerous role being added to a member
     * @param {Guild} guild - The guild
     * @param {GuildMember} member - The member receiving the role
     * @param {Role} role - The role with dangerous permissions
     * @param {Array} permissions - Array of dangerous permissions in the role
     */
    async handleDangerousRoleAddition(guild, member, role, permissions) {
        logger.security('DANGEROUS_ROLE', `Member ${member.user.tag} (${member.id}) in ${guild.name} was given role ${role.name} with dangerous permissions: ${permissions.join(', ')}`);
        
        try {
            // Get the person who added the role
            const auditLogs = await guild.fetchAuditLogs({
                type: 'MEMBER_ROLE_UPDATE',
                limit: 1,
            });
            
            const roleUpdateLog = auditLogs.entries.first();
            let updater = null;
            
            if (roleUpdateLog && roleUpdateLog.target.id === member.id) {
                updater = roleUpdateLog.executor;
            }
            
            // Skip checks if no updater found (rare case)
            if (!updater) {
                // Remove the role without further checks
                await member.roles.remove(role.id);
                return;
            }
            
            // If updater is owner or in the owners list, allow
            if (guild.ownerId === updater.id || config.owners.includes(updater.id)) {
                return;
            }
            
            // Get the member who did the update
            const updaterMember = await guild.members.fetch(updater.id).catch(() => null);
            if (!updaterMember) {
                // Remove the role if updater is not in the guild anymore
                await member.roles.remove(role.id);
                return;
            }
            
            // YETKİ KORUMA SİSTEMİNDE ROL HİYERARŞİSİ GEÇERLİ DEĞİL
            // Administrator yetkisine sahip olsa bile güvenlik için rol yetki koruması uygulanır
            // Sadece sunucu sahibi ve bot sahibi atlanır
            
            // Remove the role
            await member.roles.remove(role.id);
            
            // Send log to log channel
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setTitle(`${config.emojis.security} Tehlikeli Rol Ataması Engellendi`)
                    .setDescription(`Bir kullanıcıya tehlikeli yetkiler içeren bir rol verilmeye çalışıldı ve engellendi.`)
                    .addFields(
                        { name: 'Kullanıcı', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Rol', value: `${role.name} (${role.id})`, inline: true },
                        { name: 'Tehlikeli Yetkiler', value: permissions.join(', '), inline: true }
                    )
                    .setTimestamp();
                
                if (updater) {
                    embed.addField('Rolü Veren', `${updater.tag} (${updater.id})`, true);
                }
                
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error(`Error handling dangerous role addition: ${error.message}`);
        }
    }
};