const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const database = require('../../utils/database');
const ms = require('ms');

module.exports = {
    name: 'sustur',
    description: 'Bir kullanıcıyı belirli bir süre için susturur',
    usage: '<@kullanıcı> [1dk/1sa/1g/1h] [sebep]',
    aliases: ['mute', 'sus', 's'],
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
        // Etiketlenen kullanıcıyı veya ID'ye göre bulmaya çalış
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
        
        // Kullanıcının kendisini susturmaya çalışıp çalışmadığını kontrol et
        if (target.id === message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendini susturamazsın!`)
                ]
            });
        }
        
        // Kullanıcının moderatörden daha yüksek bir rolü olup olmadığını kontrol et
        if (message.member.roles.highest.position <= target.roles.highest.position && 
            message.guild.ownerId !== message.author.id) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Kendinle aynı veya daha yüksek role sahip birini susturamazsın!`)
                ]
            });
        }
        
        // Susturma rolünü konfigürasyondan al veya yoksa oluştur
        let muteRole = message.guild.roles.cache.get(config.muteRole) || 
                      message.guild.roles.cache.find(role => role.name.toLowerCase() === 'muted');
        
        if (!muteRole) {
            try {
                muteRole = await message.guild.roles.create({
                    name: 'Susturulmuş',
                    color: '#808080',
                    reason: 'Astro Bot için susturma rolü'
                });
                
                // Tüm metin kanalları için izinleri ayarla
                for (const [id, channel] of message.guild.channels.cache.filter(c => c.type === 'GUILD_TEXT')) {
                    await channel.permissionOverwrites.create(muteRole, {
                        SEND_MESSAGES: false,
                        ADD_REACTIONS: false
                    });
                }
                
                // Tüm ses kanalları için izinleri ayarla
                for (const [id, channel] of message.guild.channels.cache.filter(c => c.type === 'GUILD_VOICE')) {
                    await channel.permissionOverwrites.create(muteRole, {
                        SPEAK: false
                    });
                }
                
                logger.operation('MUTE_ROLE_CREATED', `${message.guild.name} sunucusunda susturma rolü oluşturuldu`);
            } catch (error) {
                logger.error(`Failed to create mute role: ${error.message}`);
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Susturma rolü oluşturamıyorum! Lütfen izinlerimi kontrol edin.`)
                    ]
                });
            }
        }
        
        // Eğer belirtildiyse süreyi ayrıştır - Kısaltılmış format destekleniyor
        let duration = null;
        let durationMs = null;
        let reason = 'Sebep belirtilmedi';
        
        if (args[1]) {
            // Kısaltılmış formatları destekle
            let timeArg = args[1].toLowerCase();
            
            // Süre formatlarını eşitle - örn: 1dk, 1d, 1dakika → 1m
            if (timeArg.includes('dk') || timeArg.includes('dakika') || timeArg === 'd') {
                const num = parseInt(timeArg.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                    timeArg = num + 'm'; // dakika = m (ms kütüphanesi için)
                }
            } else if (timeArg.includes('sa') || timeArg.includes('saat') || timeArg === 's') {
                const num = parseInt(timeArg.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                    timeArg = num + 'h'; // saat = h (ms kütüphanesi için)
                }
            } else if (timeArg.includes('g') || timeArg.includes('gün')) {
                const num = parseInt(timeArg.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                    timeArg = num + 'd'; // gün = d (ms kütüphanesi için)
                }
            } else if (timeArg.includes('h') || timeArg.includes('hafta')) {
                const num = parseInt(timeArg.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                    timeArg = num + 'w'; // hafta = w (ms kütüphanesi için)
                }
            }
            
            // İkinci argümanın bir süre olup olmadığını kontrol et
            const time = ms(timeArg);
            if (time) {
                duration = args[1];
                durationMs = time;
                reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
                
                // Görüntülenecek süreyi Türkçeleştir
                if (timeArg.endsWith('m')) {
                    const mins = parseInt(timeArg.replace('m', ''), 10);
                    duration = mins + ' dakika';
                } else if (timeArg.endsWith('h')) {
                    const hours = parseInt(timeArg.replace('h', ''), 10);
                    duration = hours + ' saat';
                } else if (timeArg.endsWith('d')) {
                    const days = parseInt(timeArg.replace('d', ''), 10);
                    duration = days + ' gün';
                } else if (timeArg.endsWith('w')) {
                    const weeks = parseInt(timeArg.replace('w', ''), 10);
                    duration = weeks + ' hafta';
                }
            } else {
                reason = args.slice(1).join(' ');
            }
        }
        
        try {
            // Discord.js v13 timeout özelliğini kullan
            try {
                // Timeout (zaman aşımı) uygula
                await target.timeout(durationMs, reason);
                logger.info(`${target.user.tag} kullanıcısı ${message.author.tag} tarafından ${duration || 'süresiz'} timeout aldı`);
            } catch (timeoutError) {
                logger.error(`Timeout uygulanırken hata: ${timeoutError.message}`);
                
                // Eğer timeout çalışmazsa, klasik mute rol sistemi ile dene
                await target.roles.add(muteRole);
                logger.info(`${target.user.tag} kullanıcısı ${message.author.tag} tarafından ${duration || 'süresiz'} susturuldu (rol ile)`);
            }
            
            // Susturma işlemini veritabanına kaydet
            database.addMute(message.guild.id, target.id, message.author.id, reason, durationMs);
            
            // Susturma işlemini kaydet
            logger.moderation('MUTE', message.author.tag, target.user.tag, reason);
            
            // Kullanıcıya DM gönder
            try {
                await target.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} ${message.guild.name} sunucusunda susturuldunuz`)
                        .setDescription(`**Sebep:** ${reason}`)
                        .addField('Süre', duration ? duration : 'Süresiz')
                        .setFooter({ text: `${message.author.tag} tarafından susturuldu` })
                        .setTimestamp()
                    ]
                });
            } catch (error) {
                // Kullanıcının DM'si kapalıysa yoksay
            }
            
            // Kanala onay mesajı gönder
            const durationText = duration ? `**${duration}** süreliğine` : 'süresiz olarak';
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.mute} **${target.user.tag}** ${durationText} susturuldu!\n**Sebep:** ${reason}`)
                ]
            });
            
            // Log kanalına kayıt gönder
            const logChannel = message.guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                logChannel.send({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setTitle(`${config.emojis.mute} Üye Susturuldu`)
                        .setDescription(`**${target.user.tag}** ${durationText} susturuldu.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `<@${target.id}>`, inline: true },
                            { name: 'Kullanıcı ID', value: target.id, inline: true },
                            { name: 'Moderatör', value: `<@${message.author.id}>`, inline: true },
                            { name: 'Süre', value: duration ? duration : 'Süresiz', inline: true },
                            { name: 'Sebep', value: reason }
                        )
                        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                        .setTimestamp()
                    ]
                });
            }
        } catch (error) {
            logger.error(`Mute command error: ${error.message}`);
            message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bu kullanıcıyı susturulurken bir hata oluştu!`)
                ]
            });
        }
    }
};
