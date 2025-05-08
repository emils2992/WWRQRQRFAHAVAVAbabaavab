const { Guild, Client, MessageEmbed, AuditLogEvent } = require('discord.js');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'guildUpdate',
    /**
     * @param {Guild} oldGuild - The guild before update
     * @param {Guild} newGuild - The guild after update
     * @param {Client} client - The Discord client
     */
    async execute(oldGuild, newGuild, client) {
        // URL Koruma: Sunucunun özel URL'si değiştirildiğinde işlem uygula
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
            logger.security('VANITY_URL_CHANGED', `Vanity URL changed in ${newGuild.name} from ${oldGuild.vanityURLCode} to ${newGuild.vanityURLCode}`);
            
            try {
                // Audit log kontrolü yap
                const auditLogs = await newGuild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.GuildUpdate
                });
                
                const auditEntry = auditLogs.entries.first();
                
                // Denetim kaydı girdisi varsa ve 5 saniyeden daha yeniyse
                if (auditEntry && Date.now() - auditEntry.createdTimestamp < 5000) {
                    const { executor } = auditEntry;
                    
                    // Eğer değiştiren kişi sunucu sahibi veya whitelist'te değilse
                    if (executor.id !== newGuild.ownerId && !config.owners.includes(executor.id)) {
                        logger.security('VANITY_URL_PROTECTED', `Unauthorized vanity URL change by ${executor.tag} (${executor.id}) detected`);
                        
                        // Eski URL'yi geri getirmeye çalış
                        try {
                            if (oldGuild.vanityURLCode && newGuild.features.includes('VANITY_URL')) {
                                await newGuild.setVanityURL(oldGuild.vanityURLCode);
                                logger.security('VANITY_URL_RESTORED', `Restored vanity URL to ${oldGuild.vanityURLCode}`);
                            }
                        } catch (err) {
                            logger.error(`Failed to restore vanity URL: ${err.message}`);
                        }
                        
                        // URL'yi değiştiren kişiyi cezalandır
                        try {
                            const member = await newGuild.members.fetch(executor.id);
                            
                            // Konfigure edilmiş cezaya göre işlem yap
                            const action = config.vanityUrlProtection?.action || 'remove_roles';
                            
                            if (action === 'kick') {
                                await member.kick(`${config.emojis.security} Astro Koruma: URL Koruma - Vanity URL değiştirme girişimi`);
                                logger.security('VANITY_PROTECTION', `Kicked ${executor.tag} for changing vanity URL`);
                            } else if (action === 'ban') {
                                await member.ban({
                                    reason: `${config.emojis.security} Astro Koruma: URL Koruma - Vanity URL değiştirme girişimi`,
                                    deleteMessageDays: 1
                                });
                                logger.security('VANITY_PROTECTION', `Banned ${executor.tag} for changing vanity URL`);
                            } else if (action === 'remove_roles') {
                                const oldRoles = member.roles.cache.filter(r => r.id !== newGuild.id);
                                await member.roles.set([]);
                                logger.security('VANITY_PROTECTION', `Removed roles from ${executor.tag} for changing vanity URL`);
                            }
                        } catch (err) {
                            logger.error(`Failed to punish user for vanity URL change: ${err.message}`);
                        }
                        
                        // Log kanalına bilgi gönder
                        const logChannel = newGuild.channels.cache.get(config.logChannel);
                        if (logChannel) {
                            try {
                                await logChannel.send({
                                    embeds: [new MessageEmbed()
                                        .setColor(config.embedColors.error)
                                        .setTitle(`${config.emojis.security} URL Koruma Aktif`)
                                        .setDescription(`**${executor.tag}** sunucunun özel URL'sini değiştirmeye çalıştı ve engellenmiştir.`)
                                        .addFields(
                                            { name: 'Kullanıcı', value: `<@${executor.id}>`, inline: true },
                                            { name: 'Kullanıcı ID', value: executor.id, inline: true },
                                            { name: 'Eski URL', value: oldGuild.vanityURLCode || 'Yok', inline: true },
                                            { name: 'Yeni URL', value: newGuild.vanityURLCode || 'Yok', inline: true },
                                            { name: 'Alınan Önlem', value: getActionName(config.vanityUrlProtection?.action || 'remove_roles'), inline: true }
                                        )
                                        .setTimestamp()
                                    ]
                                });
                            } catch (err) {
                                logger.error(`Failed to send log message: ${err.message}`);
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error(`Error handling vanity URL change: ${error.message}`);
            }
        }
        
        // Diğer guild update olaylarını burada işleyebilirsiniz
        
        /**
         * Eylem adını insan okuyabilir formatta döndürür
         * @param {string} action - Eylem kodu
         * @returns {string} - İnsan okuyabilir eylem adı
         */
        function getActionName(action) {
            switch (action) {
                case 'kick': return 'Sunucudan Atıldı';
                case 'ban': return 'Sunucudan Yasaklandı';
                case 'remove_roles': return 'Rolleri Alındı';
                default: return 'Bilinmeyen Eylem';
            }
        }
    }
};