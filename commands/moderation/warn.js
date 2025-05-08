const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');

module.exports = {
    name: 'uyar',
    description: 'Bir kullanıcıyı uyarır',
    usage: '<kullanıcı> <sebep>',
    aliases: ['warn', 'uyarı', 'w', 'uyarıver'],
    args: true,
    argsCount: 2,
    guildOnly: true,
    permissions: [Permissions.FLAGS.MANAGE_MESSAGES],
    cooldown: 3,
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
        
        // Kullanıcının kendisini uyarmaya çalışıp çalışmadığını kontrol et
        if (target.id === message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendini uyaramazsın!`)
                ]
            });
        }
        
        // Kullanıcının moderatörden daha yüksek bir rolü olup olmadığını kontrol et
        if (message.member.roles.highest.position <= target.roles.highest.position && 
            message.guild.ownerId !== message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Senden daha yüksek veya eşit role sahip birini uyaramazsın!`)
                ]
            });
        }
        
        // Sebep al
        const reason = args.slice(1).join(' ');
        
        if (!reason) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Uyarı için bir sebep belirtmelisin!`)
                ]
            });
        }
        
        try {
            // Uyarıyı veritabanına ekle
            const result = database.addWarning(message.guild.id, target.id, message.author.id, reason);
            
            // Uyarıyı kaydet
            logger.moderation('WARN', message.author.tag, target.user.tag, reason);
            
            // Kullanıcıya DM gönder
            try {
                await target.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.warning} ${message.guild.name} sunucusunda uyarıldın`)
                        .setDescription(`**Sebep:** ${reason}`)
                        .addField('Uyarı Sayısı', result.count.toString())
                        .setFooter({ text: `${message.author.tag} tarafından uyarıldın` })
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
                    .setDescription(`${config.emojis.warning} **${target.user.tag}** uyarıldı!\n**Sebep:** ${reason}\n**Uyarı Sayısı:** ${result.count}`)
                ]
            });
            
            // Log kanalına kayıt gönder
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.warning} Üye Uyarıldı`)
                        .setDescription(`**${target.user.tag}** uyarıldı.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `<@${target.id}>`, inline: true },
                            { name: 'Kullanıcı ID', value: target.id, inline: true },
                            { name: 'Moderatör', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Uyarı Sayısı', value: result.count.toString(), inline: true },
                            { name: 'Sebep', value: reason }
                        )
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
            
            // Kullanıcının >= 3 uyarısı varsa, daha ileri bir işlem öner
            if (result.count >= 3) {
                message.channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} **${target.user.tag}** kullanıcısının şu an ${result.count} uyarısı var. Susturma veya atma gibi daha ileri bir işlem yapmayı düşünebilirsiniz.`)
                    ]
                });
            }
            
        } catch (error) {
            logger.error(`Warn command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı uyarırken bir hata oluştu!`)
                ]
            });
        }
    }
};
