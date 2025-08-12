const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemembers')
    .setDescription('List members with a role')
    .addRoleOption(o => o.setName('role').setDescription('Role to list').setRequired(true)),
  async execute(interaction) {
    const role = interaction.options.getRole('role', true);
    await interaction.guild.members.fetch();
    const members = role.members.map(m => `${m.user.tag}`).slice(0, 50);
    const content = members.length ? members.join('\n') : 'No members with this role.';
    await interaction.reply({ content, ephemeral: content.length > 1800 });
  }
};
