const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');

module.exports = {
    name: 'kilitle',
    description: 'Bir kanalı kilitleyerek kullanıcıların mesaj göndermesini engeller',
    usage: '[kanal] [sebep]',
    aliases: ['lock', 'lockdown', 'kilit'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.MANAGE_CHANNELS],
    botPermissions: [Permissions.FLAGS.MANAGE_CHANNELS],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Get channel (mentioned, by ID, or current)
        const channel = message.mentions.channels.first() || 
                       message.guild.channels.cache.get(args[0]) || 
                       message.channel;
        
        // Type kontrolü yapılırken hata engelleme
        try {
            // Kanal tipi kontrolü (metin kanalı olmalı)
            if (!channel || (channel.type !== 'GUILD_TEXT' && channel.type !== 0)) {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Sadece metin kanallarını kilitleyebilirim!`)
                    ]
                });
            }
            
            // Sebep al
            let reason = '';
            if (args.length > 0) {
                // Eğer bir kanal etiketlendiyse, ilk argüman atlanır
                if (message.mentions.channels.first()) {
                    reason = args.slice(1).join(' ');
                } else if (message.guild.channels.cache.get(args[0])) {
                    reason = args.slice(1).join(' ');
                } else {
                    reason = args.join(' ');
                }
            }
            
            if (!reason || reason === '') {
                reason = 'Sebep belirtilmedi';
            }
            
            try {
                // Kanalı kilitle (@everyone rolü için SEND_MESSAGES iznini engelle)
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                    SEND_MESSAGES: false
                });
                
                // İşlemi kaydet
                logger.moderation('LOCK', message.author.tag, channel.name, reason);
                
                // Kanala onay mesajı gönder
                await channel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.lock} Kanal Kilitlendi`)
                        .setDescription(`Bu kanal bir moderatör tarafından kilitlendi.`)
                        .addField('Sebep', reason)
                        .setFooter({ text: `${message.author.tag} tarafından kilitlendi` })
                        .setTimestamp()
                    ]
                }).catch(e => logger.error(`Failed to send lock message: ${e.message}`));
                
                // Eğer kanal, komutun gönderildiği kanalla aynı değilse, onay mesajı gönder
                if (channel.id !== message.channel.id) {
                    await message.reply({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.success)
                            .setDescription(`${config.emojis.lock} **${channel.name}** kanalı kilitlendi!\n**Sebep:** ${reason}`)
                        ]
                    }).catch(e => logger.error(`Failed to send lock confirmation: ${e.message}`));
                }
                
                // Log kanalına kayıt gönder
                const logChannel = message.guild.channels.cache.get(config.logChannel);
                if (logChannel && logChannel.id !== channel.id) {
                    await logChannel.send({
                        embeds: [new MessageEmbed()
                            .setColor(config.embedColors.warning)
                            .setTitle(`${config.emojis.lock} Kanal Kilitlendi`)
                            .setDescription(`**${channel.name}** kanalı kilitlendi.`)
                            .addFields(
                                { name: 'Kanal', value: `<#${channel.id}>`, inline: true },
                                { name: 'Moderatör', value: `<@${message.author.id}>`, inline: true },
                                { name: 'Sebep', value: reason }
                            )
                            .setTimestamp()
                        ]
                    }).catch(e => logger.error(`Failed to send lock log: ${e.message}`));
                }
            } catch (error) {
                logger.error(`Lock command error: ${error.message}`);
                await message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Bu kanalı kilitlerken bir hata oluştu: ${error.message}`)
                    ]
                }).catch(() => {});
            }
        } catch (error) {
            logger.error(`General lock command error: ${error.message}`);
            await message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Komut çalıştırılırken beklenmeyen bir hata oluştu!`)
                ]
            }).catch(() => {});
        }
    }
};
