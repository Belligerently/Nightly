const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../lib/db');

function getLogChannel(guild, db) {
  const cfg = getGuildConfig(db, guild.id);
  if (!cfg?.log_channel_id) return null;
  return guild.channels.cache.get(cfg.log_channel_id) || null;
}

module.exports = function registerLogging(client) {
  client.on(Events.GuildMemberAdd, member => {
    const ch = getLogChannel(member.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder().setColor('Green').setDescription(`✅ ${member} joined.`).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildMemberRemove, member => {
    const ch = getLogChannel(member.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder().setColor('Red').setDescription(`❌ ${member.user?.tag || 'A user'} left.`).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    if (!newMsg?.guild || newMsg.author?.bot) return;
    const ch = getLogChannel(newMsg.guild, client.db); if (!ch) return;
    const before = oldMsg?.content || '(unknown)';
    const after = newMsg.content || '(empty)';
    if (before === after) return;
    const embed = new EmbedBuilder()
      .setColor('Yellow')
      .setTitle('Message Edited')
      .setDescription(`[Jump to message](${newMsg.url})`)
      .addFields(
        { name: 'Author', value: `${newMsg.author.tag} (${newMsg.author.id})` },
        { name: 'Channel', value: `${newMsg.channel}` },
        { name: 'Before', value: before.slice(0, 1000) },
        { name: 'After', value: after.slice(0, 1000) }
      ).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.MessageDelete, msg => {
    if (!msg?.guild || msg.author?.bot) return;
    const ch = getLogChannel(msg.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('Message Deleted')
      .addFields(
        { name: 'Author', value: `${msg.author?.tag || 'Unknown'} (${msg.author?.id || 'n/a'})` },
        { name: 'Channel', value: `${msg.channel}` },
        { name: 'Content', value: (msg.content || '(no content)').slice(0, 1000) }
      ).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildBanAdd, async ban => {
    const ch = getLogChannel(ban.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder().setColor('Red').setTitle('User Banned').setDescription(`${ban.user.tag} (${ban.user.id})`).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildBanRemove, async ban => {
    const ch = getLogChannel(ban.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder().setColor('Green').setTitle('User Unbanned').setDescription(`${ban.user.tag} (${ban.user.id})`).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });
};
