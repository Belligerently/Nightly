const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show information about this server'),
  async execute(interaction) {
    const g = interaction.guild;
    await g.fetch();
    const owner = await g.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle(g.name)
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: g.id, inline: true },
        { name: 'Members', value: String(g.memberCount), inline: true },
        { name: 'Owner', value: owner ? `${owner.user.tag} (${owner.id})` : 'Unknown', inline: false },
      );
    await interaction.reply({ embeds: [embed] });
  }
};
