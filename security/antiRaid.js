const { Collection, GuildMember, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

// Collection to store join timestamps
const joinData = new Collection();

// Track if a server is in lockdown mode
const lockdownStatus = new Collection();

module.exports = {
    /**
     * Initialize anti-raid module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-raid module initialized');
        
        // Clean up join data every 10 minutes
        setInterval(() => {
            const now = Date.now();
            joinData.forEach((data, guildId) => {
                // Remove joins older than 10 minutes
                data.joins = data.joins.filter(timestamp => now - timestamp < 600000);
                
                // If no recent joins, remove the guild from the collection
                if (data.joins.length === 0) {
                    joinData.delete(guildId);
                } else {
                    joinData.set(guildId, data);
                }
            });
        }, 600000); // 10 minutes
    },
    
    /**
     * Check user join for raid detection
     * @param {GuildMember} member 
     * @returns {boolean} Whether a raid was detected
     */
    checkJoin(member) {
        // If anti-raid is disabled, return
        if (!config.antiRaid.enabled) return false;
        
        const { guild } = member;
        const now = Date.now();
        
        // Get join data for this guild
        const data = joinData.get(guild.id) || { joins: [] };
        
        // Add current join timestamp
        data.joins.push(now);
        
        // Remove joins older than the time window
        const TIME_WINDOW = config.antiRaid.timeWindow;
        data.joins = data.joins.filter(timestamp => now - timestamp < TIME_WINDOW);
        
        // Save updated data
        joinData.set(guild.id, data);
        
        // Check if joins exceed threshold
        const JOIN_THRESHOLD = config.antiRaid.joinThreshold;
        
        if (data.joins.length >= JOIN_THRESHOLD) {
            // Raid detected
            this.handleRaid(guild, member.client);
            return true;
        }
        
        return false;
    },
    
    /**
     * Handle raid detection
     * @param {Guild} guild 
     * @param {Client} client 
     */
    async handleRaid(guild, client) {
        // Check if already in lockdown mode
        if (lockdownStatus.get(guild.id)) return;
        
        // Set lockdown status
        lockdownStatus.set(guild.id, true);
        
        // Log raid detection
        logger.security('RAID_DETECTED', `Raid detected in ${guild.name}. Taking action...`);
        
        // Take action based on config
        const action = config.antiRaid.action.toLowerCase();
        
        try {
            if (action === 'lockdown') {
                // Perform server lockdown
                await this.lockdownServer(guild, client);
            }
            
            // Send notification to log channel
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setTitle('🚨 Raid Detected')
                        .setDescription(`A raid has been detected! ${JOIN_THRESHOLD}+ members joined within ${TIME_WINDOW / 1000} seconds.`)
                        .addField('Action Taken', action === 'lockdown' ? 'Server has been locked down' : 'No action taken')
                        .setTimestamp()
                    ]
                });
            }
            
            // Clear lockdown status after 5 minutes
            setTimeout(() => {
                lockdownStatus.delete(guild.id);
            }, 300000); // 5 minutes
            
        } catch (error) {
            logger.error(`Anti-raid action error: ${error.message}`);
            lockdownStatus.delete(guild.id);
        }
    },
    
    /**
     * Lockdown the server
     * @param {Guild} guild 
     * @param {Client} client 
     */
    async lockdownServer(guild, client) {
        try {
            // Get all text channels
            const textChannels = guild.channels.cache.filter(c => c.type === 'GUILD_TEXT');
            
            // Lock down each channel
            for (const [id, channel] of textChannels) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SEND_MESSAGES: false
                });
                
                logger.security('CHANNEL_LOCKED', `Locked channel ${channel.name} in ${guild.name} due to raid detection`);
            }
            
            // Send notification to all channels
            for (const [id, channel] of textChannels) {
                if (channel.permissionsFor(guild.me).has('SEND_MESSAGES')) {
                    channel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setTitle('🚨 Server Lockdown')
                            .setDescription('This server has been automatically locked down due to a detected raid.')
                            .addField('Information', 'All channels have been locked. Server administrators can unlock channels using the `.unlock` command when the situation is under control.')
                            .setTimestamp()
                        ]
                    });
                }
            }
            
            logger.security('SERVER_LOCKDOWN', `Server ${guild.name} has been locked down due to raid detection`);
        } catch (error) {
            logger.error(`Lockdown error: ${error.message}`);
        }
    }
};
