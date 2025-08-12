const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a user')
    .addUserOption(o => o.setName('user').setDescription('Target user')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const embed = new EmbedBuilder()
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: true },
        member ? { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline: true } : { name: '\u200b', value: '\u200b', inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  }
};
