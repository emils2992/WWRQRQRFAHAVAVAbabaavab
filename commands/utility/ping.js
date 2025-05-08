const { Message, Client, MessageEmbed } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    name: 'ping',
    description: 'Check the bot\'s ping and latency',
    aliases: ['latency'],
    cooldown: 5,
    /**
     * @param {Message} message 
     * @param {string[]} args 
     * @param {Client} client 
     */
    async execute(message, args, client) {
        // Initial response
        const initialEmbed = new MessageEmbed()
            .setColor(config.embedColors.info)
            .setDescription(`${config.emojis.loading} Pinging...`);
        
        const sent = await message.reply({ embeds: [initialEmbed] });
        
        // Calculate round-trip latency
        const latency = sent.createdTimestamp - message.createdTimestamp;
        
        // Get WebSocket ping
        const apiLatency = Math.round(client.ws.ping);
        
        // Create embed with ping information
        const pingEmbed = new MessageEmbed()
            .setColor(config.embedColors.info)
            .setTitle(`${config.emojis.ping} Pong!`)
            .addFields(
                { name: 'Message Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            )
            .setFooter({ text: 'Astro Bot' })
            .setTimestamp();
        
        // Edit the message with ping results
        sent.edit({ embeds: [pingEmbed] });
    }
};
