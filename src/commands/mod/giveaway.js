const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addGiveaway, setGiveawayMessageId, getGiveawayByMessageId } = require('../../lib/db');
const { concludeGiveaway, CELEBRATE } = require('../../lib/giveaways');

function parseDuration(str) {
  const m = /^\s*(\d+)\s*([smhdw])?\s*$/i.exec(str || '');
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'm').toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : unit === 'd' ? 86400000 : 604800000;
  return n * mult;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand(sc => sc.setName('create').setDescription('Create a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize description').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration (e.g., 10m, 2h, 3d)').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(false))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(false)))
    .addSubcommand(sc => sc.setName('end').setDescription('End a running giveaway now')
      .addStringOption(o => o.setName('message').setDescription('Message link or ID').setRequired(true)))
    .addSubcommand(sc => sc.setName('reroll').setDescription('Reroll an ended giveaway')
      .addStringOption(o => o.setName('message').setDescription('Message link or ID').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const prize = interaction.options.getString('prize', true);
      const duration = interaction.options.getString('duration', true);
      const ms = parseDuration(duration);
      if (!ms || ms < 5000) return interaction.reply({ content: 'Invalid duration. Use formats like 10m, 2h, 3d.', ephemeral: true });
      const winners = Math.max(1, Math.min(25, interaction.options.getInteger('winners') ?? 1));
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel.isTextBased()) return interaction.reply({ content: 'Channel must be text-based.', ephemeral: true });
      const endsAt = Date.now() + ms;

      // Insert DB row
      const id = addGiveaway(client.db, {
        guild_id: interaction.guildId,
        channel_id: channel.id,
        prize,
        winner_count: winners,
        host_id: interaction.user.id,
        ends_at: endsAt
      });

      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway!')
        .setDescription(`Prize: ${prize}`)
        .addFields(
          { name: 'Ends', value: `<t:${Math.floor(endsAt/1000)}:R>` , inline: true },
          { name: 'Winners', value: String(winners), inline: true },
          { name: 'Host', value: `${interaction.user}`, inline: true }
        )
        .setColor('#F1C40F');

      const msg = await channel.send({ embeds: [embed] });
      await msg.react(CELEBRATE).catch(() => {});
      setGiveawayMessageId(client.db, id, msg.id);

      await interaction.reply({ content: `Giveaway created in ${channel} for "${prize}".`, ephemeral: true });
    } else if (sub === 'end') {
      const input = interaction.options.getString('message', true).trim();
      const messageId = input.match(/\d{10,}/)?.[0] || input;
      const row = getGiveawayByMessageId(client.db, interaction.guildId, messageId);
      if (!row) return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      if (row.status === 'ended') return interaction.reply({ content: 'That giveaway has already ended.', ephemeral: true });
      await concludeGiveaway(client, client.db, row, { reroll: false });
      return interaction.reply({ content: 'Giveaway ended.', ephemeral: true });
    } else if (sub === 'reroll') {
      const input = interaction.options.getString('message', true).trim();
      const messageId = input.match(/\d{10,}/)?.[0] || input;
      const row = getGiveawayByMessageId(client.db, interaction.guildId, messageId);
      if (!row) return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      if (row.status !== 'ended') return interaction.reply({ content: 'Giveaway has not ended yet.', ephemeral: true });
      await concludeGiveaway(client, client.db, row, { reroll: true });
      return interaction.reply({ content: 'Giveaway rerolled.', ephemeral: true });
    }
  }
};

