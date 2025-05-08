const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');

module.exports = {
    name: 'suskaldır',
    description: 'Bir kullanıcının susturmasını kaldırır',
    usage: '<kullanıcı> [sebep]',
    aliases: ['unmute', 'unmuteuser', 'un', 'sus-kaldır'],
    args: true,
    argsCount: 1,
    guildOnly: true,
    permissions: [Permissions.FLAGS.MANAGE_ROLES],
    botPermissions: [Permissions.FLAGS.MANAGE_ROLES],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Get the mentioned user or try to find by ID
        const target = message.mentions.members.first() || 
                      await message.guild.members.fetch(args[0]).catch(() => null);
        
        // Eğer kullanıcı bulunamadıysa
        if (!target) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı bulamıyorum!`)
                ]
            });
        }
        
        // Susturma rolünü konfigürasyondan al veya isimle bul
        const muteRole = message.guild.roles.cache.get(config.muteRole) || 
                         message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted' || role.name.toLowerCase() === 'susturulmuş');
        
        if (!muteRole) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Susturma rolünü bulamıyorum!`)
                ]
            });
        }
        
        // Kullanıcının susturulmuş olup olmadığını kontrol et
        if (!target.roles.cache.has(muteRole.id)) {
            // Timeout durumunu kontrol et (Discord native timeout)
            if (!target.communicationDisabledUntil) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Bu kullanıcı susturulmamış!`)
                    ]
                });
            }
            
            // Discord timeout varsa, onu kaldır
            try {
                await target.timeout(null, `${message.author.tag} tarafından susturma kaldırıldı`);
                
                // Veritabanından kaldır
                database.removeMute(message.guild.id, target.id);
                
                // Log
                logger.moderation('TIMEOUT_KALDIR', message.author.tag, target.user.tag, args.slice(1).join(' ') || 'Sebep belirtilmedi');
                
                // Başarılı mesaj
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setDescription(`${config.emojis.unmute} **${target.user.tag}** kullanıcısının Discord zaman aşımı kaldırıldı!\n**Sebep:** ${args.slice(1).join(' ') || 'Sebep belirtilmedi'}`)
                    ]
                });
            } catch (error) {
                logger.error(`Timeout kaldırma hatası: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Discord zaman aşımını kaldırırken bir hata oluştu.`)
                    ]
                });
            }
        }
        
        // Sebep al
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        
        try {
            // Susturma rolünü kaldır
            await target.roles.remove(muteRole);
            
            // Veritabanından kaldır
            database.removeMute(message.guild.id, target.id);
            
            // Susturma kaldırmayı kaydet
            logger.moderation('UNMUTE', message.author.tag, target.user.tag, reason);
            
            // Kullanıcıya DM gönder
            try {
                await target.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setTitle(`${config.emojis.unmute} ${message.guild.name} sunucusunda susturman kaldırıldı`)
                        .setDescription(`**Sebep:** ${reason}`)
                        .setFooter({ text: `${message.author.tag} tarafından susturman kaldırıldı` })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Kullanıcının DM'si kapalıysa yoksay
            }
            
            // Kanala onay mesajı gönder
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.unmute} **${target.user.tag}** kullanıcısının susturması kaldırıldı!\n**Sebep:** ${reason}`)
                ]
            });
            
            // Log kanalına kayıt gönder
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.success)
                        .setTitle(`${config.emojis.unmute} Üyenin Susturması Kaldırıldı`)
                        .setDescription(`**${target.user.tag}** kullanıcısının susturması kaldırıldı.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `<@${target.id}>`, inline: true },
                            { name: 'Kullanıcı ID', value: target.id, inline: true },
                            { name: 'Moderatör', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Sebep', value: reason }
                        )
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            logger.error(`Unmute command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcının susturmasını kaldırırken bir hata oluştu!`)
                ]
            });
        }
    }
};
