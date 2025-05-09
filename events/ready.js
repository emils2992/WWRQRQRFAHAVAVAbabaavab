const { Client } = require('discord.js');
const logger = require('../utils/logger');
const database = require('../utils/database');

module.exports = {
    name: 'ready',
    once: true,
    /**
     * @param {Client} client 
     */
    async execute(client) {
        logger.info(`Bot logged in as ${client.user.tag}!`);
        
        // Set bot activity
        client.user.setActivity(`.yardım | ${client.guilds.cache.size} sunucuyu koruyor`, { type: 'WATCHING' });
        
        // Log some stats
        logger.info(`Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);
        
        // Setup guilds (create necessary roles, channels, etc.)
        await setupGuilds(client);
        
        // Check for expired mutes every minute
        setInterval(() => {
            checkExpiredMutes(client);
        }, 60000); // every minute
        
        // Update activity every hour
        setInterval(() => {
            client.user.setActivity(`.yardım | ${client.guilds.cache.size} sunucuyu koruyor`, { type: 'WATCHING' });
        }, 3600000); // every hour
    }
};

/**
 * Setup guilds - create necessary roles and channels for security features
 * @param {Client} client 
 */
async function setupGuilds(client) {
    logger.info('Setting up guilds...');
    
    for (const guild of client.guilds.cache.values()) {
        try {
            logger.info(`Setting up guild: ${guild.name}`);
            
            // Get or create guild config
            let guildConfig = database.getGuildConfig(guild.id);
            
            // Initialize default config for new guild if it doesn't exist
            if (!guildConfig || Object.keys(guildConfig).length === 0) {
                // Create a deep copy of the default config
                guildConfig = JSON.parse(JSON.stringify(client.config));
                
                // Remove global settings that should be per-guild
                delete guildConfig.token;
                delete guildConfig.owners;
                
                // Initialize guild-specific fields
                guildConfig.guildId = guild.id;
                guildConfig.logChannel = null;
                guildConfig.muteRole = null;
                guildConfig.welcomeChannel = null;
            }
            
            // Create or find mute role
            let muteRole = guild.roles.cache.get(guildConfig.muteRole) || 
                          guild.roles.cache.find(role => 
                            role.name.toLowerCase() === 'muted' || 
                            role.name.toLowerCase() === 'susturulmuş');
            
            // If mute role doesn't exist, create it
            if (!muteRole) {
                logger.info(`Creating mute role in ${guild.name}`);
                try {
                    muteRole = await guild.roles.create({
                        name: 'Muted',
                        color: '#666666',
                        reason: 'Auto-created for moderation'
                    });
                    
                    // Update guild config
                    guildConfig.muteRole = muteRole.id;
                    
                    // Setup permissions for all channels
                    for (const channel of guild.channels.cache.values()) {
                        if (channel.type === 'GUILD_TEXT' || channel.type === 0) {
                            await channel.permissionOverwrites.create(muteRole, {
                                SEND_MESSAGES: false,
                                ADD_REACTIONS: false
                            }).catch(e => logger.error(`Failed to setup perms in ${channel.name}: ${e.message}`));
                        } 
                        else if (channel.type === 'GUILD_VOICE' || channel.type === 2) {
                            await channel.permissionOverwrites.create(muteRole, {
                                SPEAK: false,
                                STREAM: false
                            }).catch(e => logger.error(`Failed to setup perms in ${channel.name}: ${e.message}`));
                        }
                    }
                    
                    logger.info(`Mute role created in ${guild.name}`);
                } catch (error) {
                    logger.error(`Failed to create mute role in ${guild.name}: ${error.message}`);
                }
            }
            
            // Create or find log channel for this guild
            let logChannel = guild.channels.cache.get(guildConfig.logChannel) ||
                          guild.channels.cache.find(channel => 
                            channel.name.toLowerCase() === 'mod-logs' || 
                            channel.name.toLowerCase() === 'security-logs' ||
                            channel.name.toLowerCase() === 'logs');
            
            // If log channel doesn't exist or isn't found, create a new one
            if (!logChannel) {
                logger.info(`Creating log channel in ${guild.name}`);
                try {
                    logChannel = await guild.channels.create('security-logs', {
                        type: 'GUILD_TEXT',
                        topic: 'Security and moderation logs',
                        permissionOverwrites: [
                            {
                                id: guild.roles.everyone,
                                deny: ['VIEW_CHANNEL']
                            },
                            {
                                id: client.user.id,
                                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS']
                            }
                        ]
                    });
                    
                    // Update guild config
                    guildConfig.logChannel = logChannel.id;
                    
                    // Send test message
                    await logChannel.send({
                        embeds: [{
                            color: client.config.embedColors.info,
                            title: `${client.config.emojis.info} Log Channel Setup`,
                            description: 'This channel has been automatically created for security and moderation logs.',
                            fields: [
                                { name: 'Configured By', value: client.user.tag, inline: true },
                                { name: 'Time', value: new Date().toLocaleString(), inline: true },
                                { name: 'Guild', value: guild.name, inline: true }
                            ],
                            footer: { text: 'Astro Bot Security System' },
                            timestamp: new Date()
                        }]
                    });
                    
                    logger.info(`Log channel created in ${guild.name}`);
                } catch (error) {
                    logger.error(`Failed to create log channel in ${guild.name}: ${error.message}`);
                }
            }
            
            // Save the guild config
            database.setGuildConfig(guild.id, guildConfig);
            logger.info(`Config updated for guild ${guild.name}`);
            
        } catch (error) {
            logger.error(`Failed to setup guild ${guild.name}: ${error.message}`);
        }
    }
    
    logger.info('Guild setup complete!');
}

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
            
            // Get guild config
            const guildConfig = database.getGuildConfig(guildId);
            if (!guildConfig) continue;
            
            const muteRole = guild.roles.cache.get(guildConfig.muteRole) || 
                guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || 
                                        role.name.toLowerCase() === 'susturulmuş');
            
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
            logger.moderation('UNMUTE (AUTO)', client.user.tag, member.user.tag, 'Mute süresi doldu');
            
            try {
                // DM ile bilgilendirme gönder
                await member.send({
                    embeds: [{
                        color: client.config.embedColors.success,
                        title: `${client.config.emojis.unmute || '🔊'} Susturma Süresi Doldu`,
                        description: `**${guild.name}** sunucusundaki susturma süreniz doldu ve susturmanız otomatik olarak kaldırıldı.`,
                        timestamp: new Date()
                    }]
                }).catch(() => {}); // DM kapalıysa sessizce devam et
            } catch (error) {
                logger.debug(`Failed to send DM to unmuted user: ${error.message}`);
            }
            
            // Kullanıcının son mesaj attığı kanala bildirim gönder
            try {
                const channels = guild.channels.cache.filter(c => c.type === 'GUILD_TEXT');
                for (const [id, channel] of channels) {
                    // Kullanıcının kanalda mesaj atma yetkisi varsa
                    if (channel.permissionsFor(member).has('SEND_MESSAGES')) {
                        channel.send({
                            embeds: [{
                                color: client.config.embedColors.success,
                                description: `${client.config.emojis.unmute || '🔊'} <@${member.id}>, susturma süreniz doldu ve artık konuşabilirsiniz.`
                            }]
                        }).then(msg => {
                            // 10 saniye sonra mesajı sil
                            setTimeout(() => {
                                msg.delete().catch(() => {});
                            }, 10000);
                        }).catch(() => {
                            // Bu kanalda gönderilemezse diğer kanallara devam et
                        });
                        break; // İlk uygun kanalda mesaj gönderdikten sonra döngüden çık
                    }
                }
            } catch (error) {
                logger.debug(`Failed to send channel notification for unmuted user: ${error.message}`);
            }
            
            // Send message in log channel
            const logChannel = guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
                const emoji = client.config.emojis.unmute || '🔊';
                logChannel.send({
                    embeds: [{
                        color: client.config.embedColors.success,
                        title: `${emoji} Otomatik Susturma Kaldırma`,
                        description: `**${member.user.tag}** kullanıcısının susturması otomatik olarak kaldırıldı.`,
                        fields: [
                            { name: 'Kullanıcı', value: `<@${member.user.id}>`, inline: true },
                            { name: 'Kullanıcı ID', value: member.user.id, inline: true },
                            { name: 'Sebep', value: 'Susturma süresi doldu' }
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
