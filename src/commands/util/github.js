const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'discord-bot' } }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('Get info about a GitHub repository')
    .addStringOption(o => o.setName('repo').setDescription('owner/repo').setRequired(true)),
  async execute(interaction) {
    const full = interaction.options.getString('repo', true).trim();
    if (!/^[^\/\s]+\/[\w.-]+$/.test(full)) {
      return interaction.reply({ content: 'Provide repo as owner/name', ephemeral: true });
    }
    await interaction.deferReply();
    try {
      const json = await fetchJson(`https://api.github.com/repos/${full}`);
      if (json.message === 'Not Found') return interaction.editReply('Repo not found.');
      const embed = new EmbedBuilder()
        .setTitle(json.full_name)
        .setURL(json.html_url)
        .setDescription(json.description || 'No description')
        .addFields(
          { name: 'Stars', value: String(json.stargazers_count), inline: true },
          { name: 'Forks', value: String(json.forks_count), inline: true },
          { name: 'Open Issues', value: String(json.open_issues_count), inline: true }
        )
        .setFooter({ text: `License: ${json.license?.spdx_id || 'N/A'}` });
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      await interaction.editReply('Failed to fetch repo info.');
    }
  }
};
