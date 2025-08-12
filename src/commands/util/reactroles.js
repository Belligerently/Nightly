const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { addReactionRole } = require('../../lib/db');

/*
Modal expects JSON mapping array, e.g.
[
  { "emoji": "✅", "roleId": "123" },
  { "emoji": "❌", "roleId": "456" }
]
*/

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactroles')
    .setDescription('Create a reaction roles panel (multiple roles)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sc => sc
      .setName('create')
      .setDescription('Post a reaction roles embed via modal')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const modal = new ModalBuilder().setCustomId('rr:createModal').setTitle('Create Reaction Roles');
      const title = new TextInputBuilder().setCustomId('title').setLabel('Embed Title').setStyle(TextInputStyle.Short).setRequired(true);
      const desc = new TextInputBuilder().setCustomId('desc').setLabel('Embed Description').setStyle(TextInputStyle.Paragraph).setRequired(true);
      const color = new TextInputBuilder().setCustomId('color').setLabel('Embed Color (hex)').setStyle(TextInputStyle.Short).setRequired(false);
      const map = new TextInputBuilder().setCustomId('map').setLabel('Mappings JSON (emoji, roleId)[]').setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(title),
        new ActionRowBuilder().addComponents(desc),
        new ActionRowBuilder().addComponents(color),
        new ActionRowBuilder().addComponents(map)
      );
      await interaction.showModal(modal);
    }
  },
  async handleModal(interaction, client) {
    if (interaction.customId === 'rr:createModal') {
      const title = interaction.fields.getTextInputValue('title');
      const desc = interaction.fields.getTextInputValue('desc');
      const color = interaction.fields.getTextInputValue('color') || '#5865F2';
      const mapJson = interaction.fields.getTextInputValue('map');
      let mappings = [];
      try { mappings = JSON.parse(mapJson); } catch (_) {}
      if (!Array.isArray(mappings) || !mappings.length) {
        return interaction.reply({ content: 'Provide a valid JSON array of { emoji, roleId } objects.', ephemeral: true });
      }
      const lines = mappings.map(m => `${m.emoji} <@&${m.roleId}>`).join('\n');
      const embed = new EmbedBuilder().setTitle(title).setDescription(`${desc}\n\n${lines}`).setColor(color);
      const msg = await interaction.channel.send({ embeds: [embed] });
      // Add reactions and store mappings
      for (const m of mappings) {
        try {
          await msg.react(m.emoji);
          addReactionRole(client.db, { guild_id: interaction.guildId, channel_id: msg.channel.id, message_id: msg.id, emoji_key: String(m.emoji), role_id: String(m.roleId) });
        } catch (e) { console.error('Reaction add/store failed', e); }
      }
      await interaction.reply({ content: 'Reaction roles panel posted.', ephemeral: true });
    }
  }
};
