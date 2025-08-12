const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getGuildConfig } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verification setup and management')
    .addSubcommand(sc => sc
      .setName('panel')
      .setDescription('Post a verification panel with a button'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),
  async execute(interaction) {
    // Open modal to collect role ID and button label
    const modal = new ModalBuilder().setCustomId('verify:panelModal').setTitle('Create Verify Panel');
    const roleIdInput = new TextInputBuilder().setCustomId('roleId').setLabel('Verification Role ID').setStyle(TextInputStyle.Short).setRequired(true);
    const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Button Label (optional)').setStyle(TextInputStyle.Short).setRequired(false);
    modal.addComponents(
      new ActionRowBuilder().addComponents(roleIdInput),
      new ActionRowBuilder().addComponents(labelInput)
    );
    await interaction.showModal(modal);
    return;
  },
  async handleButton(interaction, client) {
    if (interaction.customId.startsWith('verify:click:')) {
      const roleId = interaction.customId.split(':')[2];
      if (!roleId) return interaction.reply({ content: 'Verification role is not configured yet.', ephemeral: true });
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(roleId);
        await interaction.reply({ content: 'You have been verified. Welcome!', ephemeral: true });
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: 'Could not assign the verification role. Please contact a moderator.', ephemeral: true });
      }
    }
  },
  async handleModal(interaction) {
    if (interaction.customId === 'verify:panelModal') {
      const roleId = (interaction.fields.getTextInputValue('roleId') || '').trim();
      const label = (interaction.fields.getTextInputValue('label') || 'Verify').trim();
      if (!/^[0-9]{5,}$/.test(roleId)) {
        return interaction.reply({ content: 'Please provide a valid role ID.', ephemeral: true });
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`verify:click:${roleId}`).setLabel(label || 'Verify').setStyle(ButtonStyle.Success)
      );
      await interaction.channel.send({ content: 'Click the button below to get verified and gain access.', components: [row] });
      await interaction.reply({ content: 'Verification panel posted.', ephemeral: true });
    }
  }
};
