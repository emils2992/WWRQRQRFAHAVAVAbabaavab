const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Custom format for console and file outputs
const myFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${level}]: ${message}`;
});

// Create the logger
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat
    ),
    transports: [
        // Console transport with colors
        new transports.Console({
            format: combine(
                colorize(),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                myFormat
            )
        }),
        // File transport for all logs
        new transports.File({ 
            filename: path.join(logsDir, 'combined.log') 
        }),
        // File transport for error logs
        new transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        })
    ]
});

// Function to log moderation actions
logger.moderation = (action, moderator, target, reason) => {
    const message = `MODERATION: ${action} | Moderator: ${moderator} | Target: ${target} | Reason: ${reason}`;
    logger.info(message);
};

// Function to log bot operations
logger.operation = (operation, details) => {
    const message = `OPERATION: ${operation} | Details: ${details}`;
    logger.info(message);
};

// Function to log security events
logger.security = (event, details) => {
    const message = `SECURITY: ${event} | Details: ${details}`;
    logger.warn(message);
};

module.exports = logger;
