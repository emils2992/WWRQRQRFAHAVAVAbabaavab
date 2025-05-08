const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Database folder path
const dbFolder = path.join(__dirname, '..', 'database');
const warningsFile = path.join(dbFolder, 'warnings.json');
const mutesFile = path.join(dbFolder, 'mutes.json');
const configsFile = path.join(dbFolder, 'configs.json');

// Database object
const database = {
    warnings: {},
    mutes: {},
    configs: {}
};

// Initialize database
function init() {
    // Create database folder if it doesn't exist
    if (!fs.existsSync(dbFolder)) {
        fs.mkdirSync(dbFolder);
        logger.info('Created database folder');
    }

    // Load or create warnings file
    if (fs.existsSync(warningsFile)) {
        try {
            database.warnings = JSON.parse(fs.readFileSync(warningsFile));
            logger.info('Loaded warnings database');
        } catch (error) {
            logger.error(`Failed to load warnings database: ${error.message}`);
            database.warnings = {};
        }
    } else {
        fs.writeFileSync(warningsFile, JSON.stringify({}));
        logger.info('Created warnings database file');
    }

    // Load or create mutes file
    if (fs.existsSync(mutesFile)) {
        try {
            database.mutes = JSON.parse(fs.readFileSync(mutesFile));
            logger.info('Loaded mutes database');
        } catch (error) {
            logger.error(`Failed to load mutes database: ${error.message}`);
            database.mutes = {};
        }
    } else {
        fs.writeFileSync(mutesFile, JSON.stringify({}));
        logger.info('Created mutes database file');
    }

    // Load or create configs file
    if (fs.existsSync(configsFile)) {
        try {
            database.configs = JSON.parse(fs.readFileSync(configsFile));
            logger.info('Loaded configs database');
        } catch (error) {
            logger.error(`Failed to load configs database: ${error.message}`);
            database.configs = {};
        }
    } else {
        fs.writeFileSync(configsFile, JSON.stringify({}));
        logger.info('Created configs database file');
    }
}

// Warning functions
function addWarning(guildId, userId, moderatorId, reason) {
    if (!database.warnings[guildId]) {
        database.warnings[guildId] = {};
    }
    
    if (!database.warnings[guildId][userId]) {
        database.warnings[guildId][userId] = [];
    }

    const warning = {
        id: Date.now(),
        moderatorId,
        reason,
        timestamp: new Date().toISOString()
    };

    database.warnings[guildId][userId].push(warning);
    saveWarnings();
    
    return {
        count: database.warnings[guildId][userId].length,
        warning
    };
}

function getWarnings(guildId, userId) {
    if (!database.warnings[guildId] || !database.warnings[guildId][userId]) {
        return [];
    }
    
    return database.warnings[guildId][userId];
}

function clearWarnings(guildId, userId) {
    if (!database.warnings[guildId] || !database.warnings[guildId][userId]) {
        return false;
    }
    
    const count = database.warnings[guildId][userId].length;
    database.warnings[guildId][userId] = [];
    saveWarnings();
    
    return count;
}

// Mute functions
function addMute(guildId, userId, moderatorId, reason, duration) {
    if (!database.mutes[guildId]) {
        database.mutes[guildId] = {};
    }
    
    const expiresAt = duration ? Date.now() + duration : null;
    
    database.mutes[guildId][userId] = {
        moderatorId,
        reason,
        timestamp: new Date().toISOString(),
        expiresAt
    };
    
    saveMutes();
    
    return database.mutes[guildId][userId];
}

function removeMute(guildId, userId) {
    if (!database.mutes[guildId] || !database.mutes[guildId][userId]) {
        return false;
    }
    
    delete database.mutes[guildId][userId];
    saveMutes();
    
    return true;
}

function getMute(guildId, userId) {
    if (!database.mutes[guildId] || !database.mutes[guildId][userId]) {
        return null;
    }
    
    return database.mutes[guildId][userId];
}

function getExpiredMutes() {
    const expired = [];
    const now = Date.now();
    
    for (const guildId in database.mutes) {
        for (const userId in database.mutes[guildId]) {
            const mute = database.mutes[guildId][userId];
            if (mute.expiresAt && mute.expiresAt < now) {
                expired.push({
                    guildId,
                    userId,
                    mute
                });
            }
        }
    }
    
    return expired;
}

// Guild config functions
function getGuildConfig(guildId) {
    return database.configs[guildId] || {};
}

function setGuildConfig(guildId, config) {
    database.configs[guildId] = config;
    saveConfigs();
    return config;
}

// Save functions
function saveWarnings() {
    fs.writeFileSync(warningsFile, JSON.stringify(database.warnings, null, 2));
}

function saveMutes() {
    fs.writeFileSync(mutesFile, JSON.stringify(database.mutes, null, 2));
}

function saveConfigs() {
    fs.writeFileSync(configsFile, JSON.stringify(database.configs, null, 2));
}

module.exports = {
    init,
    addWarning,
    getWarnings,
    clearWarnings,
    addMute,
    removeMute,
    getMute,
    getExpiredMutes,
    getGuildConfig,
    setGuildConfig
};
