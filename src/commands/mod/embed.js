const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send a custom embed using a popup')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('embed:modal')
      .setTitle('Create Embed');

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const description = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
    const color = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Hex Color (e.g., #5865F2)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    const channelId = new TextInputBuilder()
      .setCustomId('channelId')
      .setLabel('Channel ID (optional, default current)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(description),
      new ActionRowBuilder().addComponents(color),
      new ActionRowBuilder().addComponents(channelId)
    );

    await interaction.showModal(modal);
  },
  async handleModal(interaction) {
    // invoked from loader when customId startsWith('embed:')
    const title = interaction.fields.getTextInputValue('title');
    const description = interaction.fields.getTextInputValue('description');
    const color = interaction.fields.getTextInputValue('color') || '#5865F2';
    const channelId = interaction.fields.getTextInputValue('channelId');
    const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({ content: 'Invalid channel.', ephemeral: true });
    }
    const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: 'Embed sent.', ephemeral: true });
  }
};
