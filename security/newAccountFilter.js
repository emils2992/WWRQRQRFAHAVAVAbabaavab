const { GuildMember, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    /**
     * Initialize new account filter module
     * @param {Client} client 
     */
    init(client) {
        logger.info('New account filter module initialized');
    },
    
    /**
     * Check if a member's account is too new
     * @param {GuildMember} member 
     * @returns {boolean} Whether the account was filtered
     */
    checkAccount(member) {
        // Skip if new account filter is disabled
        if (!config.newAccountFilter || !config.newAccountFilter.enabled) return false;
        
        // Get minimum account age (in days)
        const minAge = config.newAccountFilter.minAge || 7;
        
        // Calculate account age in days
        const accountAge = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        
        // If account is older than minimum, allow
        if (accountAge >= minAge) return false;
        
        // Filter the new account
        this.handleNewAccount(member, accountAge, minAge);
        return true;
    },
    
    /**
     * Handle detected new account
     * @param {GuildMember} member 
     * @param {number} accountAge - Account age in days
     * @param {number} minAge - Minimum required age in days
     */
    async handleNewAccount(member, accountAge, minAge) {
        logger.security('NEW_ACCOUNT_FILTERED', `New account ${member.user.tag} (${member.id}) was blocked from joining ${member.guild.name}. Account age: ${accountAge.toFixed(2)} days`);
        
        try {
            // Send DM to the user
            try {
                await member.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setTitle(`${config.emojis.account} Hesap Çok Yeni`)
                        .setDescription(`**${member.guild.name}** sunucusuna katılmanız engellendi çünkü hesabınız çok yeni.`)
                        .addField('Hesap Yaşı', `${accountAge.toFixed(2)} gün`, true)
                        .addField('Gerekli Yaş', `${minAge} gün`, true)
                        .setFooter({ text: 'Bu bir güvenlik önlemidir.' })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Ignore if DM failed
            }
            
            // Kick the user
            await member.kick(`${config.emojis.account} Astro Koruma: Yeni hesap (${accountAge.toFixed(2)} gün < ${minAge} gün)`);
            
            // Send log to log channel
            const logChannel = member.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                await logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.account} Yeni Hesap Engellendi`)
                        .setDescription(`Yeni bir hesap sunucuya katılmaya çalıştı ve engellendi.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `${member.user.tag} (${member.id})`, inline: true },
                            { name: 'Hesap Yaşı', value: `${accountAge.toFixed(2)} gün`, inline: true },
                            { name: 'Gerekli Yaş', value: `${minAge} gün`, inline: true },
                            { name: 'Oluşturulma Tarihi', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true }
                        )
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            logger.error(`New account filter error: ${error.message}`);
        }
    }
};