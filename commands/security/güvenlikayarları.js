const { Message, Client, MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Permissions } = require('discord.js');
const config = require('../../config.json');
const logger = require('../../utils/logger');
const fs = require('fs');

module.exports = {
    name: 'güvenlikayarları',
    description: 'Tüm güvenlik modüllerinin ayarlarını tek bir yerden yönetmenizi sağlar',
    usage: '[modül]',
    aliases: ['securitysettings', 'security-settings', 'güvenlik-ayarları', 'ga', 'korumaayarları'],
    guildOnly: true,
    permissions: [Permissions.FLAGS.ADMINISTRATOR],
    botPermissions: [Permissions.FLAGS.ADMINISTRATOR],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        try {
            // Ana menü gösterimi
            if (!args.length) {
                return showMainMenu(message, client);
            }
            
            // Belirli bir modülün ayarlarını göster
            const moduleName = args[0].toLowerCase();
            
            if (moduleName === 'spam' || moduleName === 'antispam') {
                return showSpamSettings(message, client);
            }
            else if (moduleName === 'link' || moduleName === 'antilink') {
                return showLinkSettings(message, client);
            }
            else if (moduleName === 'raid' || moduleName === 'antiraid') {
                return showRaidSettings(message, client);
            }
            else if (moduleName === 'bot' || moduleName === 'antibots') {
                return showBotSettings(message, client);
            }
            else if (moduleName === 'hesap' || moduleName === 'newaccount') {
                return showAccountSettings(message, client);
            }
            else if (moduleName === 'limit' || moduleName === 'limits') {
                return showLimitSettings(message, client);
            }
            else if (moduleName === 'yetki' || moduleName === 'permguard') {
                return showPermSettings(message, client);
            }
            else if (moduleName === 'kelime' || moduleName === 'wordfilter') {
                return showWordSettings(message, client);
            }
            else if (moduleName === 'emoji' || moduleName === 'emojifilter') {
                return showEmojiSettings(message, client);
            }
            else {
                return message.reply({
                    embeds: [new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz modül adı! Kullanılabilir modüller: spam, link, raid, bot, hesap, limit, yetki, kelime, emoji`)
                    ]
                });
            }
        } catch (error) {
            logger.error(`Güvenlik ayarları komutu hatası: ${error.message}`);
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Bir hata oluştu: ${error.message}`)
                ]
            }).catch(() => {});
        }
    }
};

/**
 * Ana güvenlik ayarları menüsünü gösterir
 * @param {Message} message 
 * @param {Client} client
 */
async function showMainMenu(message, client) {
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTitle(`${config.emojis.security} Güvenlik Ayarları`)
        .setDescription(`Aşağıdan düzenlemek istediğiniz güvenlik modülünü seçin.`)
        .addFields(
            { name: '📊 Modül Durumları', value: getModuleStatusText(), inline: false }
        )
        .setFooter({ text: `${message.guild.name} • Güvenlik Kontrol Paneli`, iconURL: message.guild.iconURL({ dynamic: true }) });
    
    const modulesRow = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('security_module_select')
                .setPlaceholder('Düzenlenecek modülü seçin')
                .addOptions([
                    {
                        label: 'Anti-Spam',
                        description: 'Spam koruma ayarları',
                        value: 'spam',
                        emoji: '🔁'
                    },
                    {
                        label: 'Link Koruma',
                        description: 'Link engelleme ayarları',
                        value: 'link',
                        emoji: '🔗'
                    },
                    {
                        label: 'Raid Koruma',
                        description: 'Saldırı koruma ayarları',
                        value: 'raid',
                        emoji: '🛡️'
                    },
                    {
                        label: 'Bot Filtresi',
                        description: 'Bot ekleme kontrolü',
                        value: 'bot',
                        emoji: '🤖'
                    },
                    {
                        label: 'Yeni Hesap Filtresi',
                        description: 'Yeni hesap engelleme',
                        value: 'account',
                        emoji: '👤'
                    },
                    {
                        label: 'İşlem Limitleri',
                        description: 'Hızlı işlem sınırlamaları',
                        value: 'limits',
                        emoji: '⏱️'
                    },
                    {
                        label: 'Yetki Koruması',
                        description: 'Tehlikeli yetki güvenliği',
                        value: 'perm',
                        emoji: '🔐'
                    },
                    {
                        label: 'Kelime Filtresi',
                        description: 'Yasaklı kelime kontrolü',
                        value: 'word',
                        emoji: '🔤'
                    },
                    {
                        label: 'Emoji Filtresi',
                        description: 'Emoji spam engelleme',
                        value: 'emoji',
                        emoji: '😄'
                    }
                ])
        );
    
    const msg = await message.reply({
        embeds: [embed],
        components: [modulesRow]
    });
    
    // Modül seçimi için buton collector
    const collector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id,
        time: 300000 // 5 dakika
    });
    
    collector.on('collect', async (interaction) => {
        try {
            await interaction.deferUpdate();
        } catch (error) {
            logger.error(`Etkileşim hatası: ${error.message}`);
            // Eğer etkileşim zaten yanıtlanmışsa hata mesajını görmezden gel ve devam et
        }
        
        if (interaction.customId === 'security_module_select') {
            const selectedModule = interaction.values[0];
            
            if (selectedModule === 'spam') {
                await showSpamSettings(message, client, msg);
            }
            else if (selectedModule === 'link') {
                await showLinkSettings(message, client, msg);
            }
            else if (selectedModule === 'raid') {
                await showRaidSettings(message, client, msg);
            }
            else if (selectedModule === 'bot') {
                await showBotSettings(message, client, msg);
            }
            else if (selectedModule === 'account') {
                await showAccountSettings(message, client, msg);
            }
            else if (selectedModule === 'limits') {
                await showLimitSettings(message, client, msg);
            }
            else if (selectedModule === 'perm') {
                await showPermSettings(message, client, msg);
            }
            else if (selectedModule === 'word') {
                await showWordSettings(message, client, msg);
            }
            else if (selectedModule === 'emoji') {
                await showEmojiSettings(message, client, msg);
            }
        }
    });
    
    collector.on('end', () => {
        try {
            msg.edit({ components: [] }).catch(() => {});
        } catch (error) {
            logger.error(`Menü süresi doldurma hatası: ${error.message}`);
        }
    });
}

/**
 * Anti-Spam ayarlarını gösterir ve düzenler
 * @param {Message} message 
 * @param {Client} client 
 * @param {Message} existingMsg - Eğer var olan bir mesaj güncellenecekse
 */
async function showSpamSettings(message, client, existingMsg = null) {
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTitle(`${config.emojis.security} Anti-Spam Ayarları`)
        .addFields(
            { name: 'Durum', value: config.antiSpam.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
            { name: 'Mesaj Limiti', value: `${config.antiSpam.maxMessages} mesaj / ${config.antiSpam.timeWindow / 1000} saniye`, inline: true },
            { name: 'Susturma Süresi', value: `${config.antiSpam.muteTime} dakika`, inline: true }
        )
        .setDescription(`Spam koruması ayarlarını düzenlemek için aşağıdaki butonları kullanın.`)
        .setFooter({ text: `${message.guild.name} • Anti-Spam Ayarları`, iconURL: message.guild.iconURL({ dynamic: true }) });
    
    // Temel ayarlar için düğmeler
    const settingsRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('as_toggle')
                .setLabel(config.antiSpam.enabled ? 'Devre Dışı Bırak' : 'Aktif Et')
                .setStyle(config.antiSpam.enabled ? 'DANGER' : 'SUCCESS'),
            new MessageButton()
                .setCustomId('as_msgcount')
                .setLabel('Mesaj Limiti')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('as_timewindow')
                .setLabel('Zaman Penceresi')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('as_mutetime')
                .setLabel('Susturma Süresi')
                .setStyle('PRIMARY')
        );
    
    // Geri buton satırı
    const backRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('back_to_main')
                .setLabel('Ana Menüye Dön')
                .setStyle('SECONDARY')
                .setEmoji('↩️')
        );
    
    // Mesaj gönderme veya güncelleme
    const msg = existingMsg ? 
        await existingMsg.edit({ embeds: [embed], components: [settingsRow, backRow] }).catch(e => {
            logger.error(`Mesaj güncelleme hatası: ${e.message}`);
            return message.reply({ embeds: [embed], components: [settingsRow, backRow] });
        }) : 
        await message.reply({ embeds: [embed], components: [settingsRow, backRow] });
    
    // Düğmeler için collector
    const collector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id,
        time: 300000 // 5 dakika
    });
    
    collector.on('collect', async (interaction) => {
        try {
            await interaction.deferUpdate();
        } catch (error) {
            logger.error(`Etkileşim hatası: ${error.message}`);
            // Eğer etkileşim zaten yanıtlanmışsa hata mesajını görmezden gel ve devam et
        }
        
        if (interaction.customId === 'back_to_main') {
            return showMainMenu(message, client, msg);
        }
        else if (interaction.customId === 'as_toggle') {
            // Anti-Spam durumunu değiştir
            config.antiSpam.enabled = !config.antiSpam.enabled;
            saveConfig();
            return showSpamSettings(message, client, msg);
        }
        else if (interaction.customId === 'as_msgcount') {
            // Mesaj limiti için düğmeler göster
            const countEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Spam Mesaj Limiti Ayarı')
                .setDescription(`Spam algılaması için belirli bir sürede gönderilecek maksimum mesaj sayısını seçin.\n\nŞu anki değer: **${config.antiSpam.maxMessages} mesaj**`)
                .setFooter({ text: 'Bu değer, belirlenen zaman penceresi içinde gönderilen mesaj sayısını sınırlar.' });
            
            const countRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('as_count_3').setLabel('3 Mesaj').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_count_4').setLabel('4 Mesaj').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_count_5').setLabel('5 Mesaj').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_count_7').setLabel('7 Mesaj').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_count_10').setLabel('10 Mesaj').setStyle('PRIMARY')
                );
            
            const backToSpamRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_spam')
                        .setLabel('Spam Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [countEmbed], components: [countRow, backToSpamRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('as_count_')) {
            // Mesaj sayısı değerini güncelle
            const countValue = parseInt(interaction.customId.replace('as_count_', ''));
            config.antiSpam.maxMessages = countValue;
            saveConfig();
            return showSpamSettings(message, client, msg);
        }
        else if (interaction.customId === 'as_timewindow') {
            // Zaman penceresi için düğmeler göster
            const timeEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Spam Zaman Penceresi Ayarı')
                .setDescription(`Spam algılaması için mesajların kontrol edileceği zaman aralığını seçin.\n\nŞu anki değer: **${config.antiSpam.timeWindow / 1000} saniye**`)
                .setFooter({ text: 'Bu süre içinde maksimum mesaj limitini aşan kullanıcılar spam yapıyor olarak değerlendirilir.' });
            
            const timeRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('as_time_3').setLabel('3 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_time_5').setLabel('5 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_time_7').setLabel('7 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_time_10').setLabel('10 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_time_15').setLabel('15 Saniye').setStyle('PRIMARY')
                );
            
            const backToSpamRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_spam')
                        .setLabel('Spam Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [timeEmbed], components: [timeRow, backToSpamRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('as_time_')) {
            // Zaman penceresi değerini güncelle
            const timeValue = parseInt(interaction.customId.replace('as_time_', ''));
            config.antiSpam.timeWindow = timeValue * 1000; // Milisaniyeye çevir
            saveConfig();
            return showSpamSettings(message, client, msg);
        }
        else if (interaction.customId === 'as_mutetime') {
            // Susturma süresi için düğmeler göster
            const muteEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Spam Susturma Süresi Ayarı')
                .setDescription(`Spam yapan kullanıcılar için susturma süresini seçin.\n\nŞu anki değer: **${config.antiSpam.muteTime} dakika**`)
                .setFooter({ text: 'Spam yapan kullanıcılar bu süre boyunca mesaj gönderemeyecekler.' });
            
            const muteRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('as_mute_5').setLabel('5 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_10').setLabel('10 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_15').setLabel('15 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_30').setLabel('30 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_60').setLabel('1 Saat').setStyle('PRIMARY')
                );
            
            const muteRow2 = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('as_mute_120').setLabel('2 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_240').setLabel('4 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_480').setLabel('8 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_720').setLabel('12 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('as_mute_1440').setLabel('24 Saat').setStyle('PRIMARY')
                );
            
            const backToSpamRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_spam')
                        .setLabel('Spam Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [muteEmbed], components: [muteRow, muteRow2, backToSpamRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('as_mute_')) {
            // Susturma süresi değerini güncelle
            const muteValue = parseInt(interaction.customId.replace('as_mute_', ''));
            config.antiSpam.muteTime = muteValue;
            saveConfig();
            return showSpamSettings(message, client, msg);
        }
        else if (interaction.customId === 'back_to_spam') {
            return showSpamSettings(message, client, msg);
        }
    });
    
    collector.on('end', () => {
        try {
            msg.edit({ components: [] }).catch(() => {});
        } catch (error) {
            logger.error(`Collector sonu hatası: ${error.message}`);
        }
    });
}

/**
 * Link koruma ayarlarını gösterir ve düzenler
 * @param {Message} message 
 * @param {Client} client 
 * @param {Message} existingMsg - Eğer var olan bir mesaj güncellenecekse
 */
async function showLinkSettings(message, client, existingMsg = null) {
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTitle(`${config.emojis.link} Link Koruma Ayarları`)
        .addFields(
            { name: 'Durum', value: config.antiLink.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
            { name: 'Eylem', value: config.antiLink.action === 'delete' ? '🗑️ Sil' : 
                        config.antiLink.action === 'warn' ? '⚠️ Uyar' : 
                        config.antiLink.action === 'mute' ? '🔇 Sustur' : 'Bilinmiyor', inline: true },
            { name: 'Susturma Süresi', value: `${config.antiLink.muteDuration} dakika`, inline: true }
        )
        .setDescription(`Link koruma ayarlarını düzenlemek için aşağıdaki butonları kullanın.\n\n**Beyaz Liste:**\n${config.antiLink.whitelist.length > 0 ? config.antiLink.whitelist.map(d => `\`${d}\``).join(', ') : 'Beyaz listede hiç domain yok.'}`)
        .setFooter({ text: `${message.guild.name} • Link Koruma Ayarları`, iconURL: message.guild.iconURL({ dynamic: true }) });
    
    // Temel ayarlar için düğmeler
    const settingsRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('al_toggle')
                .setLabel(config.antiLink.enabled ? 'Devre Dışı Bırak' : 'Aktif Et')
                .setStyle(config.antiLink.enabled ? 'DANGER' : 'SUCCESS'),
            new MessageButton()
                .setCustomId('al_action')
                .setLabel('Eylem Değiştir')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('al_muteduration')
                .setLabel('Susturma Süresi')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('al_whitelist')
                .setLabel('Beyaz Liste')
                .setStyle('PRIMARY')
        );
    
    // Geri buton satırı
    const backRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('back_to_main')
                .setLabel('Ana Menüye Dön')
                .setStyle('SECONDARY')
                .setEmoji('↩️')
        );
    
    // Mesaj gönderme veya güncelleme
    const msg = existingMsg ? 
        await existingMsg.edit({ embeds: [embed], components: [settingsRow, backRow] }).catch(e => {
            logger.error(`Mesaj güncelleme hatası: ${e.message}`);
            return message.reply({ embeds: [embed], components: [settingsRow, backRow] });
        }) : 
        await message.reply({ embeds: [embed], components: [settingsRow, backRow] });
    
    // Düğmeler için collector
    const collector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id,
        time: 300000 // 5 dakika
    });
    
    collector.on('collect', async (interaction) => {
        try {
            await interaction.deferUpdate();
        } catch (error) {
            logger.error(`Etkileşim hatası: ${error.message}`);
            // Eğer etkileşim zaten yanıtlanmışsa hata mesajını görmezden gel ve devam et
        }
        
        if (interaction.customId === 'back_to_main') {
            return showMainMenu(message, client, msg);
        }
        else if (interaction.customId === 'al_toggle') {
            // Link koruma durumunu değiştir
            config.antiLink.enabled = !config.antiLink.enabled;
            saveConfig();
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_action') {
            // Eylem ayarı için düğmeler
            const actionEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Link Koruma Eylemi')
                .setDescription(`Link paylaşımı durumunda gerçekleştirilecek eylemi seçin.\n\nŞu anki eylem: **${config.antiLink.action === 'delete' ? 'Sadece Sil' : 
                                config.antiLink.action === 'warn' ? 'Uyar' : 
                                config.antiLink.action === 'mute' ? 'Sustur' : 'Bilinmiyor'}**`)
                .setFooter({ text: 'Kullanıcıya uygulanacak işlemi seçin.' });
            
            const actionRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('al_action_delete').setLabel('Sadece Sil').setEmoji('🗑️').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_action_warn').setLabel('Uyar').setEmoji('⚠️').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_action_mute').setLabel('Sustur').setEmoji('🔇').setStyle('PRIMARY')
                );
            
            const backToLinkRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_link')
                        .setLabel('Link Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [actionEmbed], components: [actionRow, backToLinkRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('al_action_')) {
            // Eylem değerini güncelle
            const actionValue = interaction.customId.replace('al_action_', '');
            config.antiLink.action = actionValue;
            saveConfig();
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_muteduration') {
            // Susturma süresi için düğmeler
            const muteEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Link Paylaşımı Susturma Süresi')
                .setDescription(`Link paylaşan kullanıcılar için susturma süresini seçin.\n\nŞu anki değer: **${config.antiLink.muteDuration} dakika**`)
                .setFooter({ text: 'Yasak link paylaşan kullanıcılar bu süre boyunca mesaj gönderemeyecekler.' });
            
            const muteRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('al_mute_5').setLabel('5 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_10').setLabel('10 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_15').setLabel('15 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_30').setLabel('30 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_60').setLabel('1 Saat').setStyle('PRIMARY')
                );
            
            const muteRow2 = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('al_mute_120').setLabel('2 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_240').setLabel('4 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_480').setLabel('8 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_720').setLabel('12 Saat').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_mute_1440').setLabel('24 Saat').setStyle('PRIMARY')
                );
            
            const backToLinkRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_link')
                        .setLabel('Link Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [muteEmbed], components: [muteRow, muteRow2, backToLinkRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('al_mute_')) {
            // Susturma süresi değerini güncelle
            const muteValue = parseInt(interaction.customId.replace('al_mute_', ''));
            config.antiLink.muteDuration = muteValue;
            saveConfig();
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'back_to_link') {
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_whitelist') {
            // Beyaz liste için düğmeler
            const whitelistEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Link Beyaz Liste Yönetimi')
                .setDescription(`İzin verilecek domainleri yönetmek için aşağıdaki butonları kullanın.\n\n**Mevcut Beyaz Liste:**\n${config.antiLink.whitelist.length > 0 ? config.antiLink.whitelist.map(d => `\`${d}\``).join(', ') : 'Beyaz listede hiç domain yok.'}`)
                .setFooter({ text: 'Beyaz listedeki domainlere içeren linkler engellenmeyecektir.' });
            
            const whitelistRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('al_whitelist_add')
                        .setLabel('Domain Ekle')
                        .setStyle('SUCCESS')
                        .setEmoji('➕'),
                    new MessageButton()
                        .setCustomId('al_whitelist_remove')
                        .setLabel('Domain Sil')
                        .setStyle('DANGER')
                        .setEmoji('➖'),
                    new MessageButton()
                        .setCustomId('back_to_link')
                        .setLabel('Link Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            // Yaygın domainler için hızlı ekle butonları
            const commonDomainsRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('al_add_youtube').setLabel('YouTube').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_add_discord').setLabel('Discord').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_add_instagram').setLabel('Instagram').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_add_twitter').setLabel('Twitter/X').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('al_add_twitch').setLabel('Twitch').setStyle('PRIMARY')
                );
            
            try {
                await msg.edit({ embeds: [whitelistEmbed], components: [whitelistRow, commonDomainsRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        // Yaygın domainleri ekleme butonları
        else if (interaction.customId === 'al_add_youtube') {
            addToWhitelist('youtube.com');
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_add_discord') {
            addToWhitelist('discord.com');
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_add_instagram') {
            addToWhitelist('instagram.com');
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_add_twitter') {
            addToWhitelist('twitter.com');
            return showLinkSettings(message, client, msg);
        }
        else if (interaction.customId === 'al_add_twitch') {
            addToWhitelist('twitch.tv');
            return showLinkSettings(message, client, msg);
        }
        // Beyaz liste yönetimi butonları
        else if (interaction.customId === 'al_whitelist_add') {
            // Kullanıcıdan eklenecek domain bilgisini iste
            const promptEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Domain Ekleme')
                .setDescription('Lütfen beyaz listeye eklemek istediğiniz domaini yazın.\n\nÖrnek: `example.com`')
                .setFooter({ text: 'Domain eklemek için 30 saniyeniz var. İptal etmek için "iptal" yazın.' });
            
            try {
                await msg.edit({ embeds: [promptEmbed], components: [] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
                return;
            }
            
            // Kullanıcının cevabını bekle
            const filter = m => m.author.id === message.author.id;
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                .catch(() => {
                    try {
                        msg.edit({ 
                            embeds: [new MessageEmbed().setColor(config.embedColors.error).setDescription('⏱️ Zaman aşımı! Domain ekleme iptal edildi.')],
                            components: []
                        });
                        setTimeout(() => showLinkSettings(message, client, msg), 2000);
                    } catch (e) {
                        logger.error(`Zaman aşımı mesaj hatası: ${e.message}`);
                    }
                    return null;
                });
            
            if (collected) {
                const response = collected.first();
                response.delete().catch(() => {});
                
                if (response.content.toLowerCase() === 'iptal') {
                    return showLinkSettings(message, client, msg);
                }
                
                // Domain formatını düzenle
                let domain = response.content.toLowerCase()
                    .replace('http://', '')
                    .replace('https://', '')
                    .replace('www.', '')
                    .split('/')[0];
                
                // Geçerli bir domain mi kontrol et
                if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)) {
                    const errorEmbed = new MessageEmbed()
                        .setColor(config.embedColors.error)
                        .setDescription(`${config.emojis.error} Geçersiz domain formatı! Lütfen "example.com" formatında bir domain girin.`);
                    
                    try {
                        await msg.edit({ embeds: [errorEmbed], components: [] });
                        setTimeout(() => showLinkSettings(message, client, msg), 2000);
                    } catch (e) {
                        logger.error(`Mesaj düzenleme hatası: ${e.message}`);
                    }
                    return;
                }
                
                // Zaten listede mi kontrol et
                if (config.antiLink.whitelist.includes(domain)) {
                    const errorEmbed = new MessageEmbed()
                        .setColor(config.embedColors.warning)
                        .setDescription(`${config.emojis.warning} \`${domain}\` zaten beyaz listede!`);
                    
                    try {
                        await msg.edit({ embeds: [errorEmbed], components: [] });
                        setTimeout(() => showLinkSettings(message, client, msg), 2000);
                    } catch (e) {
                        logger.error(`Mesaj düzenleme hatası: ${e.message}`);
                    }
                    return;
                }
                
                // Değeri ekle ve kaydet
                config.antiLink.whitelist.push(domain);
                saveConfig();
                
                const successEmbed = new MessageEmbed()
                    .setColor(config.embedColors.success)
                    .setDescription(`${config.emojis.success} \`${domain}\` başarıyla beyaz listeye eklendi!`);
                
                try {
                    await msg.edit({ embeds: [successEmbed], components: [] });
                    setTimeout(() => showLinkSettings(message, client, msg), 2000);
                } catch (e) {
                    logger.error(`Mesaj düzenleme hatası: ${e.message}`);
                }
            }
        }
        else if (interaction.customId === 'al_whitelist_remove') {
            // Beyaz listeden domain silme
            if (config.antiLink.whitelist.length === 0) {
                const errorEmbed = new MessageEmbed()
                    .setColor(config.embedColors.warning)
                    .setDescription(`${config.emojis.warning} Beyaz listede silinecek domain yok!`);
                
                try {
                    await msg.edit({ embeds: [errorEmbed], components: [] });
                    setTimeout(() => showLinkSettings(message, client, msg), 2000);
                } catch (e) {
                    logger.error(`Mesaj düzenleme hatası: ${e.message}`);
                }
                return;
            }
            
            // Domain seçme menüsü oluştur
            const selectOptions = config.antiLink.whitelist.map(domain => {
                return {
                    label: domain,
                    value: domain,
                    description: `Beyaz listeden ${domain} domainini sil`
                };
            });
            
            const selectEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Domain Silme')
                .setDescription('Beyaz listeden silmek istediğiniz domaini seçin:')
                .setFooter({ text: 'Seçilen domain beyaz listeden kaldırılacaktır.' });
            
            const selectRow = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('al_whitelist_remove_select')
                        .setPlaceholder('Silinecek domaini seçin')
                        .addOptions(selectOptions)
                );
            
            const backToLinkRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_link')
                        .setLabel('Link Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [selectEmbed], components: [selectRow, backToLinkRow] });
            } catch (e) {
                logger.error(`Mesaj düzenleme hatası: ${e.message}`);
            }
        }
        else if (interaction.customId === 'al_whitelist_remove_select') {
            // Seçilen domaini beyaz listeden sil
            const domainToRemove = interaction.values[0];
            
            // Değeri çıkar ve kaydet
            config.antiLink.whitelist = config.antiLink.whitelist.filter(domain => domain !== domainToRemove);
            saveConfig();
            
            const successEmbed = new MessageEmbed()
                .setColor(config.embedColors.success)
                .setDescription(`${config.emojis.success} \`${domainToRemove}\` başarıyla beyaz listeden silindi!`);
            
            try {
                await msg.edit({ embeds: [successEmbed], components: [] });
                setTimeout(() => showLinkSettings(message, client, msg), 2000);
            } catch (e) {
                logger.error(`Mesaj düzenleme hatası: ${e.message}`);
            }
        }
    });
    
    collector.on('end', () => {
        try {
            msg.edit({ components: [] }).catch(() => {});
        } catch (error) {
            logger.error(`Collector sonu hatası: ${error.message}`);
        }
    });
}

/**
 * İşlem limitleri ayarlarını gösterir ve düzenler
 * @param {Message} message 
 * @param {Client} client 
 * @param {Message} existingMsg - Eğer var olan bir mesaj güncellenecekse
 */
async function showLimitSettings(message, client, existingMsg = null) {
    const timeWindowSeconds = config.limits.timeWindow / 1000;
    
    const embed = new MessageEmbed()
        .setColor(config.embedColors.info)
        .setTitle(`⏱️ İşlem Limitleri Ayarları`)
        .addFields(
            { name: 'Durum', value: config.limits.enabled ? '✅ Aktif' : '❌ Devre Dışı', inline: true },
            { name: 'Zaman Penceresi', value: `${timeWindowSeconds} saniye`, inline: true },
            { name: 'Eylem', value: config.limits.action === 'ban' ? '🔨 Yasakla' : 
                       config.limits.action === 'kick' ? '👢 At' : 
                       config.limits.action === 'mute' ? '🔇 Sustur' : 'Bilinmiyor', inline: true },
            { name: 'Kanal Oluşturma Limiti', value: `${config.limits.channelCreate} kanal / ${timeWindowSeconds}s`, inline: true },
            { name: 'Kanal Silme Limiti', value: `${config.limits.channelDelete} kanal / ${timeWindowSeconds}s`, inline: true },
            { name: 'Rol Oluşturma Limiti', value: `${config.limits.roleCreate} rol / ${timeWindowSeconds}s`, inline: true },
            { name: 'Rol Silme Limiti', value: `${config.limits.roleDelete} rol / ${timeWindowSeconds}s`, inline: true },
            { name: 'Atma Limiti', value: `${config.limits.kick} kullanıcı / ${timeWindowSeconds}s`, inline: true },
            { name: 'Yasaklama Limiti', value: `${config.limits.ban} kullanıcı / ${timeWindowSeconds}s`, inline: true },
            { name: 'Toplu Etiket Limiti', value: `${config.limits.massTag} etiket / ${timeWindowSeconds}s`, inline: true }
        )
        .setDescription(`İşlem limitleri, kısa sürede çok sayıda tehlikeli eylem yapılmasını önler.`)
        .setFooter({ text: `${message.guild.name} • İşlem Limitleri Ayarları`, iconURL: message.guild.iconURL({ dynamic: true }) });
    
    // Temel limit ayarları için düğmeler
    const settingsRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('limit_toggle')
                .setLabel(config.limits.enabled ? 'Devre Dışı Bırak' : 'Aktif Et')
                .setStyle(config.limits.enabled ? 'DANGER' : 'SUCCESS'),
            new MessageButton()
                .setCustomId('limit_timewindow')
                .setLabel('Zaman Penceresi')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('limit_action')
                .setLabel('Limit Aşım Eylemi')
                .setStyle('PRIMARY')
        );
    
    // Limit seçimleri için butonlar
    const limitSelectRow = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('limit_select')
                .setPlaceholder('Değiştirmek istediğiniz limiti seçin')
                .addOptions([
                    {
                        label: 'Kanal Oluşturma Limiti',
                        description: `Şu an: ${config.limits.channelCreate} kanal`,
                        value: 'channelCreate',
                        emoji: '📝'
                    },
                    {
                        label: 'Kanal Silme Limiti',
                        description: `Şu an: ${config.limits.channelDelete} kanal`,
                        value: 'channelDelete',
                        emoji: '🗑️'
                    },
                    {
                        label: 'Rol Oluşturma Limiti',
                        description: `Şu an: ${config.limits.roleCreate} rol`,
                        value: 'roleCreate',
                        emoji: '👑'
                    },
                    {
                        label: 'Rol Silme Limiti',
                        description: `Şu an: ${config.limits.roleDelete} rol`,
                        value: 'roleDelete',
                        emoji: '❌'
                    },
                    {
                        label: 'Atma Limiti',
                        description: `Şu an: ${config.limits.kick} kullanıcı`,
                        value: 'kick',
                        emoji: '👢'
                    },
                    {
                        label: 'Yasaklama Limiti',
                        description: `Şu an: ${config.limits.ban} kullanıcı`,
                        value: 'ban',
                        emoji: '🔨'
                    },
                    {
                        label: 'Toplu Etiket Limiti',
                        description: `Şu an: ${config.limits.massTag} etiket`,
                        value: 'massTag',
                        emoji: '📢'
                    }
                ])
        );
    
    // Geri buton satırı
    const backRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('back_to_main')
                .setLabel('Ana Menüye Dön')
                .setStyle('SECONDARY')
                .setEmoji('↩️')
        );
    
    // Mesaj gönderme veya güncelleme
    const msg = existingMsg ? 
        await existingMsg.edit({ embeds: [embed], components: [settingsRow, limitSelectRow, backRow] }).catch(e => {
            logger.error(`Mesaj güncelleme hatası: ${e.message}`);
            return message.reply({ embeds: [embed], components: [settingsRow, limitSelectRow, backRow] });
        }) : 
        await message.reply({ embeds: [embed], components: [settingsRow, limitSelectRow, backRow] });
    
    // Düğmeler için collector
    const collector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === message.author.id,
        time: 300000 // 5 dakika
    });
    
    collector.on('collect', async (interaction) => {
        try {
            await interaction.deferUpdate();
        } catch (error) {
            logger.error(`Etkileşim hatası: ${error.message}`);
            // Eğer etkileşim zaten yanıtlanmışsa hata mesajını görmezden gel ve devam et
        }
        
        if (interaction.customId === 'back_to_main') {
            return showMainMenu(message, client, msg);
        }
        else if (interaction.customId === 'limit_toggle') {
            // Limit sistemi durumunu değiştir
            config.limits.enabled = !config.limits.enabled;
            saveConfig();
            return showLimitSettings(message, client, msg);
        }
        else if (interaction.customId === 'limit_timewindow') {
            // Zaman penceresi için düğmeler
            const timeEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Limit Zaman Penceresi Ayarı')
                .setDescription(`Limitlerin kontrol edileceği zaman aralığını seçin.\n\nŞu anki değer: **${config.limits.timeWindow / 1000} saniye**`)
                .setFooter({ text: 'Bu süre içinde belirlenen limit üzerinde işlem yapılırsa güvenlik eylemi gerçekleştirilir.' });
            
            const timeRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('limit_time_3').setLabel('3 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_5').setLabel('5 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_10').setLabel('10 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_15').setLabel('15 Saniye').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_30').setLabel('30 Saniye').setStyle('PRIMARY')
                );
            
            const timeRow2 = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('limit_time_60').setLabel('1 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_120').setLabel('2 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_300').setLabel('5 Dakika').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_time_600').setLabel('10 Dakika').setStyle('PRIMARY')
                );
            
            const backToLimitRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_limit')
                        .setLabel('Limit Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [timeEmbed], components: [timeRow, timeRow2, backToLimitRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('limit_time_')) {
            // Zaman penceresi değerini güncelle
            const timeValue = parseInt(interaction.customId.replace('limit_time_', ''));
            config.limits.timeWindow = timeValue * 1000; // Milisaniyeye çevir
            saveConfig();
            return showLimitSettings(message, client, msg);
        }
        else if (interaction.customId === 'limit_action') {
            // Limit aşıldığında yapılacak eylem için düğmeler
            const actionEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle('Limit Aşım Eylemi')
                .setDescription(`İşlem limitleri aşıldığında gerçekleştirilecek eylemi seçin.\n\nŞu anki eylem: **${
                    config.limits.action === 'ban' ? 'Yasakla' : 
                    config.limits.action === 'kick' ? 'At' : 
                    config.limits.action === 'mute' ? 'Sustur' : 'Bilinmiyor'
                }**`)
                .setFooter({ text: 'Limit aşımı durumunda kullanıcıya uygulanacak işlemi seçin.' });
            
            const actionRow = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId('limit_action_ban').setLabel('Yasakla').setEmoji('🔨').setStyle('DANGER'),
                    new MessageButton().setCustomId('limit_action_kick').setLabel('At').setEmoji('👢').setStyle('PRIMARY'),
                    new MessageButton().setCustomId('limit_action_mute').setLabel('Sustur').setEmoji('🔇').setStyle('SECONDARY')
                );
            
            const backToLimitRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_limit')
                        .setLabel('Limit Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [actionEmbed], components: [actionRow, backToLimitRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('limit_action_')) {
            // Eylem değerini güncelle
            const actionValue = interaction.customId.replace('limit_action_', '');
            config.limits.action = actionValue;
            saveConfig();
            return showLimitSettings(message, client, msg);
        }
        else if (interaction.customId === 'back_to_limit') {
            return showLimitSettings(message, client, msg);
        }
        else if (interaction.customId === 'limit_select') {
            // Seçilen limit türü için değer ayarlama ekranı
            const limitType = interaction.values[0];
            const limitNames = {
                channelCreate: 'Kanal Oluşturma',
                channelDelete: 'Kanal Silme',
                roleCreate: 'Rol Oluşturma',
                roleDelete: 'Rol Silme',
                kick: 'Atma',
                ban: 'Yasaklama',
                massTag: 'Toplu Etiket'
            };
            
            const limitEmbed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle(`${limitNames[limitType]} Limiti Ayarı`)
                .setDescription(`${timeWindowSeconds} saniye içinde izin verilecek maksimum ${limitNames[limitType].toLowerCase()} sayısını seçin.\n\nŞu anki değer: **${config.limits[limitType]}**`)
                .setFooter({ text: `Bu limit aşıldığında ${config.limits.action} eylemi gerçekleştirilecektir.` });
            
            // Limit sayısı butonları (1-10 arası)
            const limitRow1 = new MessageActionRow();
            for (let i = 1; i <= 5; i++) {
                limitRow1.addComponents(
                    new MessageButton()
                        .setCustomId(`limit_value_${limitType}_${i}`)
                        .setLabel(`${i}`)
                        .setStyle('PRIMARY')
                );
            }
            
            const limitRow2 = new MessageActionRow();
            for (let i = 6; i <= 10; i++) {
                limitRow2.addComponents(
                    new MessageButton()
                        .setCustomId(`limit_value_${limitType}_${i}`)
                        .setLabel(`${i}`)
                        .setStyle('PRIMARY')
                );
            }
            
            // Daha yüksek limit sayıları için butonlar
            const limitRow3 = new MessageActionRow()
                .addComponents(
                    new MessageButton().setCustomId(`limit_value_${limitType}_15`).setLabel('15').setStyle('PRIMARY'),
                    new MessageButton().setCustomId(`limit_value_${limitType}_20`).setLabel('20').setStyle('PRIMARY'),
                    new MessageButton().setCustomId(`limit_value_${limitType}_25`).setLabel('25').setStyle('PRIMARY'),
                    new MessageButton().setCustomId(`limit_value_${limitType}_30`).setLabel('30').setStyle('PRIMARY'),
                    new MessageButton().setCustomId(`limit_value_${limitType}_50`).setLabel('50').setStyle('PRIMARY')
                );
            
            const backToLimitRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('back_to_limit')
                        .setLabel('Limit Ayarlarına Dön')
                        .setStyle('SECONDARY')
                        .setEmoji('↩️')
                );
            
            try {
                await msg.edit({ embeds: [limitEmbed], components: [limitRow1, limitRow2, limitRow3, backToLimitRow] });
            } catch (error) {
                logger.error(`Mesaj düzenleme hatası: ${error.message}`);
            }
        }
        else if (interaction.customId.startsWith('limit_value_')) {
            // Limit değerini güncelle
            const [_, __, limitType, limitValue] = interaction.customId.split('_');
            config.limits[limitType] = parseInt(limitValue);
            saveConfig();
            return showLimitSettings(message, client, msg);
        }
    });
    
    collector.on('end', () => {
        try {
            msg.edit({ components: [] }).catch(() => {});
        } catch (error) {
            logger.error(`Collector sonu hatası: ${error.message}`);
        }
    });
}

/**
 * Modüllerin durum bilgilerini içeren metin üretir
 * @returns {string} Modül durumlarını içeren metin
 */
function getModuleStatusText() {
    return `
🔁 **Anti-Spam:** ${config.antiSpam.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
🔗 **Link Koruma:** ${config.antiLink.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
🛡️ **Raid Koruma:** ${config.antiRaid.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
🤖 **Bot Filtresi:** ${config.antiBots.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
👤 **Yeni Hesap Filtresi:** ${config.newAccountFilter.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
⏱️ **İşlem Limitleri:** ${config.limits.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
🔐 **Yetki Koruması:** ${config.permGuard.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
🔤 **Kelime Filtresi:** ${config.wordFilter.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
😄 **Emoji Filtresi:** ${config.emojiFilter.enabled ? '✅ Aktif' : '❌ Devre Dışı'}
    `.trim();
}

/**
 * Beyaz listeye domain ekler
 * @param {string} domain - Eklenecek domain
 */
function addToWhitelist(domain) {
    if (!config.antiLink.whitelist.includes(domain)) {
        config.antiLink.whitelist.push(domain);
        saveConfig();
    }
}

/**
 * Ayarları config.json dosyasına kaydeder
 */
function saveConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 4));
}

/**
 * Yeni hesap filtresi ayarlarını gösterir ve düzenler (Kısaltılmış örnek)
 */
async function showAccountSettings(message, client, existingMsg = null) {
    // Bu örnekte kısaltılmış olarak gösterilmiştir
    // Tam implementasyon benzer yapıda olacaktır
    try {
        message.reply("Hesap filtresi ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Hesap filtresi hatası: ${error.message}`);
    }
}

/**
 * Diğer modüllerin ayar fonksiyonları (Placeholder)
 */
async function showRaidSettings(message, client, existingMsg = null) {
    try {
        message.reply("Raid koruma ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Raid ayarları hatası: ${error.message}`);
    }
}

async function showBotSettings(message, client, existingMsg = null) {
    try {
        message.reply("Bot filtresi ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Bot filtresi hatası: ${error.message}`);
    }
}

async function showPermSettings(message, client, existingMsg = null) {
    try {
        message.reply("Yetki koruması ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Yetki koruması hatası: ${error.message}`);
    }
}

async function showWordSettings(message, client, existingMsg = null) {
    try {
        message.reply("Kelime filtresi ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Kelime filtresi hatası: ${error.message}`);
    }
}

async function showEmojiSettings(message, client, existingMsg = null) {
    try {
        message.reply("Emoji filtresi ayarları henüz eklenmedi!");
    } catch (error) {
        logger.error(`Emoji filtresi hatası: ${error.message}`);
    }
}