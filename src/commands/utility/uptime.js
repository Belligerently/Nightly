const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show bot uptime and latency')
    .setDMPermission(false),
  async execute(interaction) {
    const up = process.uptime();
    const d = Math.floor(up / 86400);
    const h = Math.floor((up % 86400) / 3600);
    const m = Math.floor((up % 3600) / 60);
    const s = Math.floor(up % 60);
    const sent = await interaction.reply({ content: 'Measuring…', fetchReply: true });
    const rtt = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Uptime: ${d}d ${h}h ${m}m ${s}s · WebSocket: ${interaction.client.ws.ping}ms · RTT: ${rtt}ms`);
  }
};

