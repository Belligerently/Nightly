const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { upsertGuildConfig, getGuildConfig, setTranscriptChannel } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setconfig')
    .setDescription('Configure bot settings (admin only).')
    .addSubcommand(sc => sc
      .setName('logchannel')
      .setDescription('Set the logging channel')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('tickets')
      .setDescription('Set the ticket category')
      .addChannelOption(o => o.setName('category').setDescription('Ticket category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('verificationrole')
      .setDescription('Set the verification role')
      .addRoleOption(o => o.setName('role').setDescription('Verification role').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('adminrole')
      .setDescription('Set the admin role allowed to use admin commands')
      .addRoleOption(o => o.setName('role').setDescription('Admin role').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('transcripts')
      .setDescription('Set the channel where ticket transcripts will be sent')
      .addChannelOption(o => o.setName('channel').setDescription('Transcript channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('staffrole')
      .setDescription('Set the staff role to ping on new tickets')
      .addRoleOption(o => o.setName('role').setDescription('Staff role').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  adminOnly: true,
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel', true);
      upsertGuildConfig(client.db, interaction.guildId, { log_channel_id: channel.id });
      return interaction.reply({ content: `Log channel set to <#${channel.id}>`, ephemeral: true });
    }

    if (sub === 'tickets') {
      const category = interaction.options.getChannel('category', true);
      upsertGuildConfig(client.db, interaction.guildId, { ticket_category_id: category.id });
      return interaction.reply({ content: `Ticket category set to ${category.name}`, ephemeral: true });
    }

    if (sub === 'verificationrole') {
      const role = interaction.options.getRole('role', true);
      upsertGuildConfig(client.db, interaction.guildId, { verification_role_id: role.id });
      return interaction.reply({ content: `Verification role set to ${role.name}`, ephemeral: true });
    }

    if (sub === 'adminrole') {
      const role = interaction.options.getRole('role', true);
      upsertGuildConfig(client.db, interaction.guildId, { admin_role_id: role.id });
      return interaction.reply({ content: `Admin role set to ${role.name}`, ephemeral: true });
    }

    if (sub === 'transcripts') {
      const channel = interaction.options.getChannel('channel', true);
      setTranscriptChannel(client.db, interaction.guildId, channel.id);
      return interaction.reply({ content: `Transcript channel set to <#${channel.id}>`, ephemeral: true });
    }

    if (sub === 'staffrole') {
      const role = interaction.options.getRole('role', true);
      upsertGuildConfig(client.db, interaction.guildId, { staff_role_id: role.id });
      return interaction.reply({ content: `Staff role set to ${role.name}`, ephemeral: true });
    }
  }
};
