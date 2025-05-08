const { GuildMember, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    /**
     * Initialize anti-bot module
     * @param {Client} client 
     */
    init(client) {
        logger.info('Anti-bot module initialized');
    },
    
    /**
     * Check if a member is a bot and should be blocked
     * @param {GuildMember} member 
     * @returns {boolean} Whether the bot was blocked
     */
    checkBot(member) {
        // Skip if anti-bot is disabled
        if (!config.antiBots || !config.antiBots.enabled) return false;
        
        // If not a bot, skip
        if (!member.user.bot) return false;
        
        // Check if the bot is whitelisted
        const whitelistedBots = config.antiBots.whitelistedBots || [];
        if (whitelistedBots.includes(member.id)) return false;
        
        // Ban the bot
        this.handleBot(member);
        return true;
    },
    
    /**
     * Handle detected bot
     * @param {GuildMember} member 
     */
    async handleBot(member) {
        logger.security('BOT_BLOCKED', `Bot ${member.user.tag} (${member.id}) was blocked from joining ${member.guild.name}`);
        
        try {
            // Ban the bot
            await member.ban({ 
                reason: `${config.emojis.bot} Astro Koruma: Bot girişi engellendi` 
            });
            
            // Get the person who added the bot
            const auditLogs = await member.guild.fetchAuditLogs({
                type: 'BOT_ADD',
                limit: 1,
            });
            
            const botAddLog = auditLogs.entries.first();
            let adder;
            
            if (botAddLog && botAddLog.target.id === member.id) {
                adder = botAddLog.executor;
            }
            
            // Send log to log channel
            const logChannel = member.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setTitle(`${config.emojis.bot} Bot Engellendi`)
                    .setDescription(`Beyaz listede olmayan bir bot sunucuya eklenmeye çalışıldı ve engellendi.`)
                    .addFields(
                        { name: 'Bot', value: `${member.user.tag} (${member.id})`, inline: true }
                    )
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();
                
                if (adder) {
                    embed.addField('Ekleyen', `${adder.tag} (${adder.id})`, true);
                }
                
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error(`Anti-bot error: ${error.message}`);
        }
    }
};