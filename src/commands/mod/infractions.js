const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning, listWarnings, removeWarning } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infractions')
    .setDescription('Warn users and view/remove infractions')
    .addSubcommand(sc => sc.setName('warn').setDescription('Warn a user')
      .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)))
    .addSubcommand(sc => sc.setName('list').setDescription('List a user\'s warnings')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(sc => sc.setName('remove').setDescription('Remove a specific warning by ID')
      .addIntegerOption(o => o.setName('id').setDescription('Warning ID').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'warn') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';
      addWarning(interaction.client.db, { guild_id: interaction.guildId, user_id: user.id, moderator_id: interaction.user.id, reason });
      return interaction.reply({ content: `Warned ${user.tag}: ${reason}`, ephemeral: true });
    }
    if (sub === 'list') {
      const user = interaction.options.getUser('user', true);
      const rows = listWarnings(interaction.client.db, interaction.guildId, user.id);
      if (!rows.length) return interaction.reply({ content: 'No warnings found.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`Warnings for ${user.tag}`).setColor('#ffcc00');
      for (const r of rows.slice(0, 10)) {
        embed.addFields({ name: `ID ${r.id} • ${new Date(r.created_at).toLocaleString()}`, value: r.reason || '(no reason)' });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === 'remove') {
      const id = interaction.options.getInteger('id', true);
      removeWarning(interaction.client.db, id, interaction.guildId);
      return interaction.reply({ content: `Removed warning ${id}.`, ephemeral: true });
    }
  }
};
