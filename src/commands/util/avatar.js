const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get a user\'s avatar')
    .addUserOption(o => o.setName('user').setDescription('Target user')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });
    await interaction.reply({ content: url });
  }
};
