const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const { checkPermissions } = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'yardım',
    description: 'Kullanılabilir komutların listesini veya belirli bir komut hakkında bilgi gösterir',
    usage: '[komut]',
    aliases: ['help', 'commands', 'h', 'komutlar', 'bilgi', 'y'],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        const prefix = config.prefix;
        const { commands } = client;
        
        // Emoji ve kategori isimlerini alma fonksiyonları
        function getCategoryEmoji(category) {
            category = category.toLowerCase();
            
            if (category.includes('moderation')) return config.emojis.ban || '🔨';
            if (category.includes('utility')) return config.emojis.info || 'ℹ️';
            if (category.includes('fun')) return '🎮';
            if (category.includes('music')) return '🎵';
            if (category.includes('economy')) return '💰';
            if (category.includes('level')) return '📊';
            
            return config.emojis.info || 'ℹ️';
        }
        
        function getCategoryName(category) {
            category = category.toLowerCase();
            
            if (category.includes('moderation')) return 'Moderasyon';
            if (category.includes('utility')) return 'Yardımcı';
            if (category.includes('fun')) return 'Eğlence';
            if (category.includes('music')) return 'Müzik';
            if (category.includes('economy')) return 'Ekonomi';
            if (category.includes('level')) return 'Seviye';
            
            return category.charAt(0).toUpperCase() + category.slice(1);
        }
        
        // If no command is specified, show all commands
        if (!args.length) {
            // Get all command categories
            const categories = new Set();
            const commandsDir = path.join(__dirname, '..', '..');
            
            function getCategories(dir) {
                const files = fs.readdirSync(dir);
                
                for (const file of files) {
                    const filepath = path.join(dir, file);
                    const stat = fs.statSync(filepath);
                    
                    if (stat.isDirectory() && file === 'commands') {
                        const subdirs = fs.readdirSync(filepath);
                        for (const subdir of subdirs) {
                            const subpath = path.join(filepath, subdir);
                            if (fs.statSync(subpath).isDirectory()) {
                                categories.add(subdir);
                            }
                        }
                    } else if (stat.isDirectory()) {
                        getCategories(filepath);
                    }
                }
            }
            
            getCategories(commandsDir);
            
            // Create embed
            const embed = new MessageEmbed()
                .setColor(config.embedColors.info)
                .setTitle(`${config.emojis.help} Astro Bot Komutları`)
                .setDescription(`Bir komut hakkında daha fazla bilgi için \`${prefix}yardım [komut]\` kullanın.`)
                .setFooter({ text: `Toplam ${client.commands.size} Komut` })
                .setTimestamp();
            
            // Add categories with their commands
            for (const category of categories) {
                const categoryCommands = [];
                
                for (const command of commands.values()) {
                    // Check if command belongs to this category
                    const commandPath = command.filepath;
                    if (commandPath && commandPath.includes(`/commands/${category}/`)) {
                        // Check if user has permission to use the command
                        if (!command.permissions || checkPermissions(message.member, command.permissions)) {
                            categoryCommands.push(`\`${command.name}\``);
                        }
                    }
                }
                
                if (categoryCommands.length) {
                    const categoryEmoji = getCategoryEmoji(category);
                    const categoryName = getCategoryName(category);
                    
                    embed.addField(
                        `${categoryEmoji} ${categoryName}`,
                        categoryCommands.join(', ')
                    );
                }
            }
            
            // Add security features section
            embed.addField(
                `${config.emojis.shield} Güvenlik Özellikleri`,
                [
                    `${config.emojis.bot || '🤖'} **Bot Filtresi** - Bilinmeyen botların sunucunuza eklenmesini engeller`,
                    `${config.emojis.account || '👤'} **Hesap Filtresi** - Yeni hesapların sunucuya girmesini engeller`,
                    `${config.emojis.channel || '📝'} **Kanal Limitleri** - Kanal ekleme/silme işlemlerini sınırlar`,
                    `${config.emojis.role || '👑'} **Rol Limitleri** - Rol oluşturma/silme işlemlerini sınırlar`,
                    `${config.emojis.kick || '👢'} **Kick & Ban Limitleri** - Atma/yasaklama işlemlerini sınırlar`,
                    `${config.emojis.security || '🔐'} **Yetki Koruma** - Rollere tehlikeli yetkilerin verilmesini engeller`,
                    `${config.emojis.link || '🔗'} **URL Koruması** - Sunucunun özel URL'sini korur`
                ].join('\n')
            );
            
            return message.reply({ embeds: [embed] });
        }
        
        // Show info about a specific command
        const name = args[0].toLowerCase();
        const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));
        
        if (!command) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} Geçerli bir komut değil!`)
                ]
            });
        }
        
        const embed = new MessageEmbed()
            .setColor(config.embedColors.info)
            .setTitle(`${config.emojis.help} Komut: ${command.name}`);
        
        if (command.description) embed.setDescription(command.description);
        if (command.aliases) embed.addField('Alternatif İsimler', command.aliases.join(', '));
        if (command.usage) embed.addField('Kullanım', `${prefix}${command.name} ${command.usage}`);
        
        embed.addField('Bekleme Süresi', `${command.cooldown || 3} saniye`);
        
        message.reply({ embeds: [embed] });
    }
};
