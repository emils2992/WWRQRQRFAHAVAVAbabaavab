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
                    // Kategori için emoji belirleme
                    let categoryEmoji = config.emojis.info || 'ℹ️';
                    if (category.toLowerCase().includes('moderation')) categoryEmoji = config.emojis.ban || '🔨';
                    if (category.toLowerCase().includes('utility')) categoryEmoji = config.emojis.info || 'ℹ️';
                    if (category.toLowerCase().includes('fun')) categoryEmoji = '🎮';
                    if (category.toLowerCase().includes('music')) categoryEmoji = '🎵';
                    if (category.toLowerCase().includes('economy')) categoryEmoji = '💰';
                    if (category.toLowerCase().includes('level')) categoryEmoji = '📊';
                    
                    // Kategori için isim belirleme
                    let categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                    if (category.toLowerCase().includes('moderation')) categoryName = 'Moderasyon';
                    if (category.toLowerCase().includes('utility')) categoryName = 'Yardımcı';
                    if (category.toLowerCase().includes('fun')) categoryName = 'Eğlence';
                    if (category.toLowerCase().includes('music')) categoryName = 'Müzik';
                    if (category.toLowerCase().includes('economy')) categoryName = 'Ekonomi';
                    if (category.toLowerCase().includes('level')) categoryName = 'Seviye';
                    
                    embed.addField(
                        `${categoryEmoji} ${categoryName}`,
                        categoryCommands.join(', ')
                    );
                }
            }
            
            // Add security features section
            embed.addField(
                `${config.emojis.shield || '🛡️'} Güvenlik Özellikleri`,
                [
                    `${config.emojis.bot || '🤖'} **Bot Filtresi** - Bilinmeyen botların sunucunuza eklenmesini engeller`,
                    `${config.emojis.account || '👤'} **Hesap Filtresi** - Yeni hesapların sunucuya girmesini engeller`,
                    `${config.emojis.spam || '🔄'} **Spam Koruma** - Hızlı mesaj spam'ını engeller`,
                    `${config.emojis.link || '🔗'} **Link Koruma** - Discord linklerini ve diğer URL'leri engeller`,
                    `${config.emojis.raid || '🚨'} **Baskın Koruma** - Ani üye artışlarını tespit eder ve önlem alır`,
                    `${config.emojis.security || '🔐'} **Yetki Koruma** - Rollere tehlikeli yetkilerin verilmesini engeller`,
                    `${config.emojis.limit || '⚠️'} **İşlem Limitleri** - Mod işlemlerinde (kick/ban/kanal/rol) limitleri uygular`
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
