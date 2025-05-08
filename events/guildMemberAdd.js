const { GuildMember, Client, MessageEmbed } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');
const antiRaid = require('../security/antiRaid');
const antiBots = require('../security/antiBots');
const newAccountFilter = require('../security/newAccountFilter');

module.exports = {
    name: 'guildMemberAdd',
    /**
     * @param {GuildMember} member 
     * @param {Client} client 
     */
    async execute(member, client) {
        // Log member join
        logger.info(`Member joined: ${member.user.tag} (${member.id}) in ${member.guild.name}`);
        
        // Check if member is a bot
        if (member.user.bot) {
            if (config.antiBots && config.antiBots.enabled) {
                const botBlocked = antiBots.checkBot(member);
                if (botBlocked) {
                    logger.security('BOT_BLOCKED', `Bot ${member.user.tag} blocked from joining ${member.guild.name}`);
                    return; // Anti-bot module will handle this
                }
            }
        }
        
        // Check new account age filter
        if (config.newAccountFilter && config.newAccountFilter.enabled) {
            const accountFiltered = newAccountFilter.checkAccount(member);
            if (accountFiltered) {
                logger.security('NEW_ACCOUNT_FILTERED', `New account ${member.user.tag} filtered from joining ${member.guild.name}`);
                return; // New account filter module will handle this
            }
        }
        
        // Check raid protection
        if (config.antiRaid && config.antiRaid.enabled) {
            const raidDetected = antiRaid.checkJoin(member);
            if (raidDetected) {
                logger.security('RAID_DETECTED', `Raid detected in ${member.guild.name}`);
                return; // Anti-raid module will handle this
            }
        }
        
        // Check if user was previously muted
        const database = require('../utils/database');
        const mute = database.getMute(member.guild.id, member.id);
        
        if (mute) {
            try {
                // Apply mute role if user was muted before leaving
                const muteRole = member.guild.roles.cache.get(config.muteRole) || 
                    member.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'susturulmuş');
                
                if (muteRole) {
                    await member.roles.add(muteRole);
                    logger.moderation('MUTE (REJOIN)', client.user.tag, member.user.tag, 'User was muted before leaving');
                    
                    // Log to channel
                    const logChannel = member.guild.channels.cache.get(config.logChannel);
                    if (logChannel) {
                        logChannel.send({
                            embeds: [new MessageEmbed()
                                .setColor(config.embedColors.warning)
                                .setTitle(`${config.emojis.mute} Susturma Yeniden Uygulandı`)
                                .setDescription(`**${member.user.tag}** susturulmuşken sunucudan ayrılıp geri döndü ve tekrar susturuldu.`)
                                .addFields(
                                    { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                                    { name: 'Kullanıcı ID', value: member.id, inline: true },
                                    { name: 'İlk Sebep', value: mute.reason || 'Sebep belirtilmedi' }
                                )
                                .setTimestamp()
                            ]
                        });
                    }
                }
            } catch (error) {
                logger.error(`Failed to apply mute on rejoin: ${error.message}`);
            }
        }
        
        // Send welcome message if enabled
        const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannel);
        if (welcomeChannel) {
            welcomeChannel.send({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.info)
                    .setTitle(`${config.emojis.success} ${member.guild.name} Sunucusuna Hoş Geldin!`)
                    .setDescription(`Hoş geldin <@${member.id}>! Umarız burada iyi vakit geçirirsin.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Üye #${member.guild.memberCount}` })
                    .setTimestamp()
                ]
            });
        }
    }
};
