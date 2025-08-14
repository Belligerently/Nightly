const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List available commands')
    .setDMPermission(false),
  async execute(interaction, client) {
    const byCat = new Map();
    for (const cmd of client.commands.values()) {
      const cat = cmd.category || 'other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(cmd);
    }
    const embed = new EmbedBuilder().setTitle('Commands').setColor('#5865F2');
    const cats = [...byCat.keys()].sort();
    for (const cat of cats) {
      const names = byCat.get(cat)
        .sort((a,b)=>a.data.name.localeCompare(b.data.name))
        .map(c => `/${c.data.name} — ${c.data.description || ''}`)
        .join('\n');
      embed.addFields({ name: cat, value: names || 'None' });
    }
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

