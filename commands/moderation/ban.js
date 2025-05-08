const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'yasakla',
    description: 'Bir kullanıcıyı sunucudan yasaklar',
    usage: '<kullanıcı> [sebep]',
    aliases: ['ban', 'banla', 'y'],
    args: true,
    argsCount: 1,
    guildOnly: true,
    permissions: [Permissions.FLAGS.BAN_MEMBERS],
    botPermissions: [Permissions.FLAGS.BAN_MEMBERS],
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
        
        // Kullanıcının yasaklanabilir olup olmadığını kontrol et
        if (!target.bannable) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı yasaklayamıyorum! Benden daha yüksek bir rolü olabilir.`)
                ]
            });
        }
        
        // Kullanıcının kendisini yasaklamaya çalışıp çalışmadığını kontrol et
        if (target.id === message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendini yasaklayamazsın!`)
                ]
            });
        }
        
        // Kullanıcının moderatörden daha yüksek bir rolü olup olmadığını kontrol et
        if (message.member.roles.highest.position <= target.roles.highest.position && 
            message.guild.ownerId !== message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendinle aynı veya daha yüksek role sahip birini yasaklayamazsın!`)
                ]
            });
        }
        
        // Sebep al
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        
        try {
            // Yasaklamadan önce kullanıcıya DM gönder
            try {
                await target.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setTitle(`${config.emojis.ban} ${message.guild.name} sunucusundan yasaklandınız`)
                        .setDescription(`**Sebep:** ${reason}`)
                        .setFooter({ text: `${message.author.tag} tarafından yasaklandı` })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Kullanıcının DM'si kapalıysa yoksay
            }
            
            // Kullanıcıyı yasakla
            await target.ban({ reason: `${message.author.tag}: ${reason}` });
            
            // Yasaklamayı kaydet
            logger.moderation('BAN', message.author.tag, target.user.tag, reason);
            
            // Kanala onay mesajı gönder
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.ban} **${target.user.tag}** yasaklandı!\n**Sebep:** ${reason}`)
                ]
            });
            
            // Log kanalına kayıt gönder
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setTitle(`${config.emojis.ban} Üye Yasaklandı`)
                        .setDescription(`**${target.user.tag}** sunucudan yasaklandı.`)
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
            logger.error(`Ban command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı yasaklarken bir hata oluştu!`)
                ]
            });
        }
    }
};
