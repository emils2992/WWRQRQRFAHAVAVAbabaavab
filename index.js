const { Client, Intents, Collection } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const { checkPermissions } = require('./utils/permissions');
const logger = require('./utils/logger');
const database = require('./utils/database');

// Initialize client with required intents
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// Initialize collections
client.commands = new Collection();
client.aliases = new Collection();
client.cooldowns = new Collection();
client.config = config;

// Set up database
database.init();

// Load handlers
const commandHandler = require('./handlers/command');
const eventHandler = require('./handlers/event');

// Initialize handlers
commandHandler.init(client);
eventHandler.init(client);

// Load security modules
const antiSpam = require('./security/antiSpam');
const antiRaid = require('./security/antiRaid');
const antiLink = require('./security/antiLink');
const antiBots = require('./security/antiBots');
const newAccountFilter = require('./security/newAccountFilter');
const limits = require('./security/limits');
const permGuard = require('./security/permGuard');
const wordFilter = require('./security/wordFilter');
const emojiFilter = require('./security/emojiFilter');

// Initialize security modules
antiSpam.init(client);
antiRaid.init(client);
antiLink.init(client);
antiBots.init(client);
newAccountFilter.init(client);
limits.init(client);
permGuard.init(client);
wordFilter.init(client);
emojiFilter.init(client);

// Handle process errors
process.on('unhandledRejection', error => {
    logger.error(`Unhandled rejection: ${error.message}`);
    console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', error => {
    logger.error(`Uncaught exception: ${error.message}`);
    console.error('Uncaught exception:', error);
});

// Create event handler for when bot joins a new guild
client.on('guildCreate', async (guild) => {
    logger.info(`Bot added to a new guild: ${guild.name} (${guild.id})`);
    
    // Get or create new guild config
    let guildConfig = database.getGuildConfig(guild.id);
    
    // If guild doesn't have a config yet, create a default one
    if (!guildConfig || Object.keys(guildConfig).length === 0) {
        // Create a deep copy of the default config
        guildConfig = JSON.parse(JSON.stringify(config));
        
        // Remove global settings that should be per-guild
        delete guildConfig.token;
        delete guildConfig.owners;
        
        // Initialize guild-specific fields
        guildConfig.guildId = guild.id;
        guildConfig.logChannel = null;
        guildConfig.muteRole = null;
        guildConfig.welcomeChannel = null;
        
        // Save the config
        database.setGuildConfig(guild.id, guildConfig);
        
        logger.info(`Created new configuration for guild: ${guild.name}`);
    }
});

// Login to Discord with the bot token
const TOKEN = process.env.DISCORD_TOKEN || config.token;
console.log("Connecting with token:", TOKEN ? "Token exists" : "No token found");
client.login(TOKEN)
    .then(() => {
        logger.info('Bot logged in successfully!');
    })
    .catch(error => {
        logger.error(`Failed to login: ${error.message}`);
        console.error('Failed to login:', error);
    });

// Export client for other modules
module.exports = client;
