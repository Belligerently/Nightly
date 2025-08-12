const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a user')
    .addSubcommand(sc => sc
      .setName('add')
      .setDescription('Add a role to a user')
      .addUserOption(o => o.setName('user').setDescription('User to modify').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('remove')
      .setDescription('Remove a role from a user')
      .addUserOption(o => o.setName('user').setDescription('User to modify').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const member = await interaction.guild.members.fetch(user.id);

    if (sub === 'add') {
      await member.roles.add(role);
      return interaction.reply({ content: `Added ${role.name} to ${user.tag}.`, ephemeral: true });
    }
    if (sub === 'remove') {
      await member.roles.remove(role);
      return interaction.reply({ content: `Removed ${role.name} from ${user.tag}.`, ephemeral: true });
    }
  }
};
