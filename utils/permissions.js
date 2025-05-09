const { Permissions } = require('discord.js');
const config = require('../config.json');
const logger = require('./logger');

/**
 * Check if a member has the required permissions
 * @param {GuildMember} member - The member to check permissions for
 * @param {Array} requiredPermissions - Array of permission flags
 * @returns {boolean} - Whether the member has the required permissions
 */
function checkPermissions(member, requiredPermissions = []) {
    // Check if the member is a server owner
    if (member.guild.ownerId === member.id) {
        return true;
    }
    
    // Check if the member is a bot owner
    if (config.owners.includes(member.user.id)) {
        return true;
    }
    
    // Check if the member's highest role is higher than the bot's highest role
    if (member.roles.highest.position > member.guild.me.roles.highest.position) {
        return true;
    }
    
    // Check if the member has admin permissions
    if (member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
        return true;
    }
    
    // Check if the member has any admin roles defined in the config
    const hasAdminRole = member.roles.cache.some(role => 
        config.adminRoles.includes(role.id)
    );
    
    if (hasAdminRole) {
        return true;
    }
    
    // Check if the member has any mod roles defined in the config
    const hasModRole = member.roles.cache.some(role => 
        config.modRoles.includes(role.id)
    );
    
    // If checking for moderator access and member has mod role
    if (hasModRole && requiredPermissions.length === 0) {
        return true;
    }
    
    // Check if the member has all the required permissions
    if (requiredPermissions.length > 0) {
        return requiredPermissions.every(permission => 
            member.permissions.has(permission)
        );
    }
    
    return false;
}

/**
 * Checks if the bot has required permissions in a channel
 * @param {TextChannel|VoiceChannel} channel - The channel to check
 * @param {Array} requiredPermissions - Array of permission flags
 * @returns {boolean} - Whether the bot has the required permissions
 */
function botHasPermissions(channel, requiredPermissions = []) {
    const me = channel.guild.me;
    
    // Check if the bot has admin permissions
    if (me.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
        return true;
    }
    
    // Check channel-specific permissions
    const channelPermissions = channel.permissionsFor(me);
    
    return requiredPermissions.every(permission => 
        channelPermissions.has(permission)
    );
}

/**
 * Get missing permissions for the bot in a channel
 * @param {TextChannel|VoiceChannel} channel - The channel to check
 * @param {Array} requiredPermissions - Array of permission flags
 * @returns {Array} - Array of missing permission names
 */
function getMissingPermissions(channel, requiredPermissions = []) {
    const me = channel.guild.me;
    
    // Check if the bot has admin permissions
    if (me.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
        return [];
    }
    
    // Check channel-specific permissions
    const channelPermissions = channel.permissionsFor(me);
    const missingPermissions = [];
    
    for (const permission of requiredPermissions) {
        if (!channelPermissions.has(permission)) {
            // Convert permission flag to readable string
            missingPermissions.push(permission);
        }
    }
    
    return missingPermissions;
}

module.exports = {
    checkPermissions,
    botHasPermissions,
    getMissingPermissions
};
