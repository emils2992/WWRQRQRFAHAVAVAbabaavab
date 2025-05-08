const { Message, Client, MessageEmbed, Permissions } = require('discord.js');
const config = require('../../config.json');
const { checkPermissions } = require('../../utils/permissions');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'help',
    description: 'Display a list of available commands or info about a specific command',
    usage: '[command]',
    aliases: ['commands', 'h'],
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
                .setTitle(`${config.emojis.help} Astro Bot Commands`)
                .setDescription(`Use \`${prefix}help [command]\` to get info about a specific command.`)
                .setFooter({ text: `${client.commands.size} Total Commands` })
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
                    embed.addField(
                        category.charAt(0).toUpperCase() + category.slice(1),
                        categoryCommands.join(', ')
                    );
                }
            }
            
            return message.reply({ embeds: [embed] });
        }
        
        // Show info about a specific command
        const name = args[0].toLowerCase();
        const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));
        
        if (!command) {
            return message.reply({
                embeds: [new MessageEmbed()
                    .setColor(config.embedColors.error)
                    .setDescription(`${config.emojis.error} That's not a valid command!`)
                ]
            });
        }
        
        const embed = new MessageEmbed()
            .setColor(config.embedColors.info)
            .setTitle(`Command: ${command.name}`);
        
        if (command.description) embed.setDescription(command.description);
        if (command.aliases) embed.addField('Aliases', command.aliases.join(', '));
        if (command.usage) embed.addField('Usage', `${prefix}${command.name} ${command.usage}`);
        
        embed.addField('Cooldown', `${command.cooldown || 3} second(s)`);
        
        message.reply({ embeds: [embed] });
    }
};
