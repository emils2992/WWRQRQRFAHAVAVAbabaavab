const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

module.exports = {
    /**
     * Initialize command handler
     * @param {Client} client 
     */
    init(client) {
        // Get commands directory
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFolders = fs.readdirSync(commandsPath);
        
        logger.info('Loading commands...');
        
        // Loop through each category folder
        for (const folder of commandFolders) {
            const categoryPath = path.join(commandsPath, folder);
            
            // Skip if not a directory
            if (!fs.statSync(categoryPath).isDirectory()) continue;
            
            // Get all command files in the category
            const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            
            // Loop through each command file
            for (const file of commandFiles) {
                const filePath = path.join(categoryPath, file);
                const command = require(filePath);
                
                // Add filepath property to command
                command.filepath = filePath;
                
                // Add command to collection
                if (command.name) {
                    client.commands.set(command.name, command);
                    logger.info(`Loaded command: ${command.name}`);
                } else {
                    logger.warn(`Command in ${filePath} is missing a name property!`);
                }
            }
        }
        
        logger.info(`Loaded ${client.commands.size} commands`);
    }
};
