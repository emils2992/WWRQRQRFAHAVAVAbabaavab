const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'at',
    description: 'Bir kullanıcıyı sunucudan atar',
    usage: '<kullanıcı> [sebep]',
    aliases: ['kick', 'k'],
    args: true,
    argsCount: 1,
    guildOnly: true,
    permissions: [Permissions.FLAGS.KICK_MEMBERS],
    botPermissions: [Permissions.FLAGS.KICK_MEMBERS],
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
        
        // Kullanıcının atılabilir olup olmadığını kontrol et
        if (!target.kickable) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı atamıyorum! Benden daha yüksek bir rolü olabilir.`)
                ]
            });
        }
        
        // Kullanıcının kendisini atmaya çalışıp çalışmadığını kontrol et
        if (target.id === message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendini atamazsın!`)
                ]
            });
        }
        
        // Kullanıcının moderatörden daha yüksek bir rolü olup olmadığını kontrol et
        if (message.member.roles.highest.position <= target.roles.highest.position && 
            message.guild.ownerId !== message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendinle aynı veya daha yüksek role sahip birini atamazsın!`)
                ]
            });
        }
        
        // Sebep al
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        
        try {
            // Atmadan önce kullanıcıya DM gönder
            try {
                await target.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.kick} ${message.guild.name} sunucusundan atıldınız`)
                        .setDescription(`**Sebep:** ${reason}`)
                        .setFooter({ text: `${message.author.tag} tarafından atıldı` })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Kullanıcının DM'si kapalıysa yoksay
            }
            
            // Kullanıcıyı at
            await target.kick(`${message.author.tag}: ${reason}`);
            
            // Atma işlemini kaydet
            logger.moderation('KICK', message.author.tag, target.user.tag, reason);
            
            // Kanala onay mesajı gönder
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.kick} **${target.user.tag}** sunucudan atıldı!\n**Sebep:** ${reason}`)
                ]
            });
            
            // Log kanalına kayıt gönder
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.kick} Üye Atıldı`)
                        .setDescription(`**${target.user.tag}** sunucudan atıldı.`)
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
            logger.error(`Kick command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı atarken bir hata oluştu!`)
                ]
            });
        }
    }
};
