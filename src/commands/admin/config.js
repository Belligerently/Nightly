const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show current bot configuration for this server')
    .addSubcommand(sc => sc.setName('show').setDescription('Display the current configuration'))
    .setDMPermission(false),
  adminOnly: true,
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'show') return;
    const cfg = getGuildConfig(client.db, interaction.guildId) || {};
    const f = (v) => v ? String(v) : 'Not set';
    const embed = new EmbedBuilder()
      .setTitle(`Configuration for ${interaction.guild.name}`)
      .addFields(
        { name: 'Log Channel', value: cfg.log_channel_id ? `<#${cfg.log_channel_id}>` : 'Not set', inline: true },
        { name: 'Ticket Category', value: f(cfg.ticket_category_id), inline: true },
        { name: 'Verification Role', value: cfg.verification_role_id ? `<@&${cfg.verification_role_id}>` : 'Not set', inline: true },
        { name: 'Admin Role', value: cfg.admin_role_id ? `<@&${cfg.admin_role_id}>` : 'Not set', inline: true },
        { name: 'Transcript Channel', value: cfg.transcript_channel_id ? `<#${cfg.transcript_channel_id}>` : 'Not set', inline: true },
        { name: 'Staff Role', value: cfg.staff_role_id ? `<@&${cfg.staff_role_id}>` : 'Not set', inline: true },
        { name: 'Welcome Channel', value: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : 'Not set', inline: true },
      )
      .setColor('#5865F2');
    try {
      const msgJson = cfg.welcome_message_json ? JSON.parse(cfg.welcome_message_json) : null;
      if (msgJson?.title || msgJson?.description) {
        embed.addFields({ name: 'Welcome Message', value: `${msgJson.title ? `Title: ${msgJson.title}\n` : ''}${msgJson.description ? `Desc: ${msgJson.description.slice(0, 120)}${msgJson.description.length>120 ? '…' : ''}` : ''}` });
      }
    } catch (_) {}
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
