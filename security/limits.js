const { Collection, MessageEmbed, Guild, GuildAuditLogs } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

// Collections to track actions by users
const channelCreateLimits = new Collection();
const channelDeleteLimits = new Collection();
const roleCreateLimits = new Collection();
const roleDeleteLimits = new Collection();
const kickLimits = new Collection();
const banLimits = new Collection();
const massTagLimits = new Collection();

module.exports = {
    /**
     * Initialize limits module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Limits module initialized');
        
        // Periodically clean up limit collections
        setInterval(() => {
            const now = Date.now();
            const timeWindow = config.limits?.timeWindow || 10000;
            
            // Clear entries older than timeWindow
            channelCreateLimits.sweep(userData => now - userData.lastAction > timeWindow);
            channelDeleteLimits.sweep(userData => now - userData.lastAction > timeWindow);
            roleCreateLimits.sweep(userData => now - userData.lastAction > timeWindow);
            roleDeleteLimits.sweep(userData => now - userData.lastAction > timeWindow);
            kickLimits.sweep(userData => now - userData.lastAction > timeWindow);
            banLimits.sweep(userData => now - userData.lastAction > timeWindow);
            massTagLimits.sweep(userData => now - userData.lastAction > timeWindow);
        }, 60000);
    },
    
    /**
     * Check channel creation limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who created the channel
     * @returns {boolean} - Whether limit was reached
     */
    checkChannelCreateLimit(guild, userId) {
        return this.checkLimit(guild, userId, channelCreateLimits, 'channelCreate', 'kanal oluşturma');
    },
    
    /**
     * Check channel deletion limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who deleted the channel
     * @returns {boolean} - Whether limit was reached
     */
    checkChannelDeleteLimit(guild, userId) {
        return this.checkLimit(guild, userId, channelDeleteLimits, 'channelDelete', 'kanal silme');
    },
    
    /**
     * Check role creation limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who created the role
     * @returns {boolean} - Whether limit was reached
     */
    checkRoleCreateLimit(guild, userId) {
        return this.checkLimit(guild, userId, roleCreateLimits, 'roleCreate', 'rol oluşturma');
    },
    
    /**
     * Check role deletion limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who deleted the role
     * @returns {boolean} - Whether limit was reached
     */
    checkRoleDeleteLimit(guild, userId) {
        return this.checkLimit(guild, userId, roleDeleteLimits, 'roleDelete', 'rol silme');
    },
    
    /**
     * Check kick limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who kicked someone
     * @returns {boolean} - Whether limit was reached
     */
    checkKickLimit(guild, userId) {
        return this.checkLimit(guild, userId, kickLimits, 'kick', 'kullanıcı atma');
    },
    
    /**
     * Check ban limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who banned someone
     * @returns {boolean} - Whether limit was reached
     */
    checkBanLimit(guild, userId) {
        return this.checkLimit(guild, userId, banLimits, 'ban', 'kullanıcı yasaklama');
    },
    
    /**
     * Check mass tag limit
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who used mass tags
     * @returns {boolean} - Whether limit was reached
     */
    checkMassTagLimit(guild, userId) {
        return this.checkLimit(guild, userId, massTagLimits, 'massTag', 'toplu etiket');
    },
    
    /**
     * Generic limit checker
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who performed the action
     * @param {Collection} collection - The collection to track this limit type
     * @param {string} limitType - The type of limit (from config)
     * @param {string} actionName - Display name for the action
     * @returns {boolean} - Whether limit was reached
     */
    checkLimit(guild, userId, collection, limitType, actionName) {
        // Skip if limits are disabled or user is owner
        if (!config.limits || !config.limits.enabled) return false;
        if (config.owners.includes(userId)) return false;
        
        // Get limit value
        const limitValue = config.limits[limitType] || 3;
        const timeWindow = config.limits.timeWindow || 10000;
        
        // Get user data
        const userData = collection.get(userId) || { 
            count: 0, 
            lastAction: Date.now(),
            warned: false
        };
        
        // Increment count
        userData.count++;
        userData.lastAction = Date.now();
        
        // Update collection
        collection.set(userId, userData);
        
        // Check if limit reached
        if (userData.count >= limitValue) {
            // Take action
            this.handleLimitReached(guild, userId, actionName, userData.count);
            return true;
        }
        
        // Check if 70% of the limit (warn user)
        if (!userData.warned && userData.count >= Math.floor(limitValue * 0.7)) {
            userData.warned = true;
            collection.set(userId, userData);
            
            // Get user
            guild.members.fetch(userId).then(member => {
                member.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.warning} Limit Uyarısı`)
                        .setDescription(`**${guild.name}** sunucusunda kısa süre içinde çok fazla ${actionName} işlemi gerçekleştirdiniz (${userData.count}/${limitValue}).\n\nLimite ulaşırsanız, sunucu güvenliği için cezalandırılabilirsiniz.`)
                        .setTimestamp()
                    ]
                }).catch(() => {}); // Ignore if DM fails
            }).catch(() => {}); // Ignore if member fetch fails
        }
        
        return false;
    },
    
    /**
     * Handle when a limit is reached
     * @param {Guild} guild - The guild
     * @param {string} userId - The user who reached the limit
     * @param {string} actionName - The name of the action
     * @param {number} count - The count reached
     */
    async handleLimitReached(guild, userId, actionName, count) {
        logger.security('LIMIT_REACHED', `User ${userId} reached ${actionName} limit (${count}) in ${guild.name}`);
        
        try {
            // Get action to take
            const action = (config.limits.action || 'kick').toLowerCase();
            
            // Get member
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return;
            
            // Yüksek yetkili bile olsa limitleri aşarsa durdur!
            // SADECE sunucu sahibi ve botun sahibi atlanır
            if (guild.ownerId === userId || (config.owners && config.owners.includes(userId))) {
                logger.warn(`Limit aşımı atlandı: ${userId} (sunucu sahibi veya bot sahibi)`);
                return;
            }
            
            // Yöneticilerin işlemleri de durdurulur - sunucu güvenliği için kritik!
            logger.warn(`YÖNETİCİ YETKİ AŞIMI: ${userId} kullanıcısı ${actionName} limitini aştı!`);
            
            // Yüksek tehlike durumunda: Yönetici yetkilerini kaldır
            try {
                if (member.permissions.has('ADMINISTRATOR')) {
                    logger.security('ADMIN_LIMIT', `${member.user.tag} admin yetkileri kaldırılıyor - tehlikeli işlem tespit edildi`);
                    
                    // Admin yetkisi veren tüm rolleri bul ve kaldır
                    const adminRoles = member.roles.cache.filter(role => 
                        role.permissions.has('ADMINISTRATOR') || 
                        role.permissions.has('BAN_MEMBERS') || 
                        role.permissions.has('MANAGE_CHANNELS') || 
                        role.permissions.has('MANAGE_GUILD') || 
                        role.permissions.has('MANAGE_ROLES')
                    );
                    
                    for (const [id, role] of adminRoles) {
                        await member.roles.remove(role, 'Güvenlik ihlali - yetki kötüye kullanımı');
                        logger.security('YETKILI_ROL_KALDIRILDI', `${member.user.tag} kullanıcısından ${role.name} rolü alındı`);
                    }
                }
            } catch (error) {
                logger.error(`Yönetici yetkilerini kaldırırken hata: ${error.message}`);
            }
            
            // Take action based on config
            if (action === 'kick') {
                try {
                    // Try to DM user first
                    await member.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setTitle(`${config.emojis.shield} Güvenlik İhlali`)
                            .setDescription(`**${guild.name}** sunucusundan atıldınız çünkü kısa süre içinde çok fazla ${actionName} işlemi gerçekleştirdiniz.`)
                            .setTimestamp()
                        ]
                    }).catch(() => {}); // Ignore if DM fails
                    
                    // Kick the member
                    await member.kick(`${config.emojis.shield} Astro Koruma: ${actionName} limiti aşıldı (${count})`);
                } catch (error) {
                    logger.error(`Failed to kick member for limit violation: ${error.message}`);
                }
            } else if (action === 'ban') {
                try {
                    // Try to DM user first
                    await member.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.error)
                            .setTitle(`${config.emojis.shield} Güvenlik İhlali`)
                            .setDescription(`**${guild.name}** sunucusundan yasaklandınız çünkü kısa süre içinde çok fazla ${actionName} işlemi gerçekleştirdiniz.`)
                            .setTimestamp()
                        ]
                    }).catch(() => {}); // Ignore if DM fails
                    
                    // Ban the member
                    await member.ban({
                        reason: `${config.emojis.shield} Astro Koruma: ${actionName} limiti aşıldı (${count})`
                    });
                } catch (error) {
                    logger.error(`Failed to ban member for limit violation: ${error.message}`);
                }
            }
            
            // Send log to log channel
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setTitle(`${config.emojis.shield} Limit Aşımı`)
                        .setDescription(`<@${userId}> kullanıcısı ${actionName} limitini aştı ve ${action === 'kick' ? 'atıldı' : 'yasaklandı'}.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `<@${userId}> (${userId})`, inline: true },
                            { name: 'İşlem', value: actionName, inline: true },
                            { name: 'Sayı', value: `${count}`, inline: true },
                            { name: 'Alınan Önlem', value: action === 'kick' ? 'Atıldı' : 'Yasaklandı', inline: true }
                        )
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            logger.error(`Error handling limit reached: ${error.message}`);
        }
    }
};