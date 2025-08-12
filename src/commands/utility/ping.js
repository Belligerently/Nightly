const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    await interaction.editReply(`Pong! Websocket: ${interaction.client.ws.ping}ms. Round-trip: ${sent.createdTimestamp - interaction.createdTimestamp}ms.`);
  }
};
