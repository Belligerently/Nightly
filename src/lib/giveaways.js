const { EmbedBuilder } = require('discord.js');

const CELEBRATE = '🎉';

async function collectEntrantsFromMessage(message) {
  try {
    const reaction = message.reactions.resolve(CELEBRATE) || message.reactions.cache.find(r => r.emoji?.name === CELEBRATE);
    if (!reaction) return [];
    const users = await reaction.users.fetch();
    const entrants = users.filter(u => !u.bot).map(u => u.id);
    // Deduplicate
    return [...new Set(entrants)];
  } catch (_) { return []; }
}

function pickWinners(list, count) {
  const arr = [...list];
  // Fisher-Yates shuffle up to count
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(count, arr.length)));
}

async function concludeGiveaway(client, db, row, { reroll = false } = {}) {
  try {
    const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
    if (!guild) return false;
    const channel = await guild.channels.fetch(row.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return false;
    const message = row.message_id ? await channel.messages.fetch(row.message_id).catch(() => null) : null;
    // Collect entrants
    let entrants = [];
    if (message) entrants = await collectEntrantsFromMessage(message);
    const winners = pickWinners(entrants, row.winner_count || 1);

    const embed = new EmbedBuilder()
      .setTitle(reroll ? '🎉 Giveaway Rerolled!' : '🎉 Giveaway Ended!')
      .setDescription(`Prize: ${row.prize}`)
      .setColor('#F1C40F')
      .setTimestamp();

    if (winners.length) {
      embed.addFields({ name: 'Winner(s)', value: winners.map(id => `<@${id}>`).join(', ') });
      await channel.send({ content: winners.map(id => `<@${id}>`).join(' '), embeds: [embed] }).catch(() => {});
    } else {
      embed.addFields({ name: 'Winner(s)', value: 'No valid entries.' });
      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    // Persist ended
    try {
      const winners_json = JSON.stringify(winners);
      db.prepare("UPDATE giveaways SET status = 'ended', winners_json = ?, ended_at = ? WHERE id = ?").run(winners_json, Date.now(), row.id);
    } catch (_) {}
    return true;
  } catch (e) {
    console.error('concludeGiveaway error', e);
    return false;
  }
}

module.exports = { concludeGiveaway, CELEBRATE };

