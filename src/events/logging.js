const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../lib/db');

function getLogChannel(guild, db) {
  const cfg = getGuildConfig(db, guild.id);
  if (!cfg?.log_channel_id) return null;
  return guild.channels.cache.get(cfg.log_channel_id) || null;
}

async function tryFetchAudit(guild, action, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type: action, limit: 5 });
    const entry = logs.entries.find(e => String(e.target?.id) === String(targetId));
    return entry || null;
  } catch (_) { return null; }
}

function buildModLine(entry) {
  if (!entry) return null;
  const exec = entry.executor ? `${entry.executor.tag} (${entry.executor.id})` : 'Unknown';
  const reason = entry.reason ? `Reason: ${entry.reason}` : null;
  return reason ? `${exec} — ${reason}` : exec;
}

module.exports = function registerLogging(client) {
  client.on(Events.GuildMemberAdd, member => {
    // Log channel
    const ch = getLogChannel(member.guild, client.db); if (ch) {
      const embed = new EmbedBuilder().setColor('Green').setDescription(`✅ ${member} joined.`).setTimestamp();
      ch.send({ embeds: [embed] }).catch(() => {});
    }
    // Welcome channel
    try {
      const cfg = getGuildConfig(client.db, member.guild.id);
      if (cfg?.welcome_channel_id && cfg?.welcome_message_json) {
        const welcomeCh = member.guild.channels.cache.get(cfg.welcome_channel_id);
        const msg = JSON.parse(cfg.welcome_message_json);
        if (welcomeCh?.isTextBased() && msg?.description) {
          const embed = new EmbedBuilder()
            .setTitle(msg.title || 'Welcome!')
            .setDescription((msg.description || '').replace('{user}', `${member}`).replace('{server}', member.guild.name))
            .setColor(msg.color || '#5865F2');
          if (msg.thumbnail) embed.setThumbnail(msg.thumbnail);
          if (msg.image) embed.setImage(msg.image);
          welcomeCh.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (e) { /* noop */ }
  });

  client.on(Events.GuildMemberRemove, member => {
    const ch = getLogChannel(member.guild, client.db); if (!ch) return;
    const embed = new EmbedBuilder().setColor('Red').setDescription(`❌ ${member.user?.tag || 'A user'} left.`).setTimestamp();
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    const ch = getLogChannel(newM.guild, client.db); if (!ch) return;
    const changes = [];
    if (oldM.nickname !== newM.nickname) {
      changes.push(`Nickname: ${oldM.nickname || 'None'} → ${newM.nickname || 'None'}`);
    }
    const oldRoles = new Set(oldM.roles.cache.keys());
    const newRoles = new Set(newM.roles.cache.keys());
    const added = [...newRoles].filter(r => !oldRoles.has(r));
    const removed = [...oldRoles].filter(r => !newRoles.has(r));
    if (added.length) changes.push(`Roles added: ${added.map(id => `<@&${id}>`).join(', ')}`);
    if (removed.length) changes.push(`Roles removed: ${removed.map(id => `<@&${id}>`).join(', ')}`);
    if (!changes.length) return;
    let modLine = null;
    try {
      const entry = await tryFetchAudit(newM.guild, AuditLogEvent.MemberRoleUpdate, newM.id) || await tryFetchAudit(newM.guild, AuditLogEvent.MemberUpdate, newM.id);
      modLine = buildModLine(entry);
    } catch (_) {}
    const embed = new EmbedBuilder()
      .setColor('Blurple')
      .setTitle('Member Updated')
      .setDescription(`${newM.user.tag} (${newM.id})`)
      .addFields({ name: 'Changes', value: changes.join('\n') })
      .setTimestamp();
    if (modLine) embed.addFields({ name: 'By', value: modLine });
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
    const entry = await tryFetchAudit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    const modLine = buildModLine(entry);
    const embed = new EmbedBuilder().setColor('Red').setTitle('User Banned').setDescription(`${ban.user.tag} (${ban.user.id})`).setTimestamp();
    if (modLine) embed.addFields({ name: 'By', value: modLine });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildBanRemove, async ban => {
    const ch = getLogChannel(ban.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    const modLine = buildModLine(entry);
    const embed = new EmbedBuilder().setColor('Green').setTitle('User Unbanned').setDescription(`${ban.user.tag} (${ban.user.id})`).setTimestamp();
    if (modLine) embed.addFields({ name: 'By', value: modLine });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  // Channel events
  client.on(Events.ChannelCreate, async channel => {
    const ch = getLogChannel(channel.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Channel Created').setDescription(`${channel} (${channel.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.ChannelUpdate, async (oldC, newC) => {
    const ch = getLogChannel(newC.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(newC.guild, AuditLogEvent.ChannelUpdate, newC.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Channel Updated').setDescription(`${newC} (${newC.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.ChannelDelete, async channel => {
    const ch = getLogChannel(channel.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    const embed = new EmbedBuilder().setColor('Red').setTitle('Channel Deleted').setDescription(`#${channel.name} (${channel.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  // Role events
  client.on(Events.GuildRoleCreate, async role => {
    const ch = getLogChannel(role.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(role.guild, AuditLogEvent.RoleCreate, role.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Role Created').setDescription(`@${role.name} (${role.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildRoleUpdate, async (oldR, newR) => {
    const ch = getLogChannel(newR.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(newR.guild, AuditLogEvent.RoleUpdate, newR.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Role Updated').setDescription(`@${newR.name} (${newR.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildRoleDelete, async role => {
    const ch = getLogChannel(role.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(role.guild, AuditLogEvent.RoleDelete, role.id);
    const embed = new EmbedBuilder().setColor('Red').setTitle('Role Deleted').setDescription(`@${role.name} (${role.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  // Emoji and sticker events
  client.on(Events.GuildEmojiCreate, async emoji => {
    const ch = getLogChannel(emoji.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Emoji Created').setDescription(`${emoji} :${emoji.name}: (${emoji.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildEmojiDelete, async emoji => {
    const ch = getLogChannel(emoji.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
    const embed = new EmbedBuilder().setColor('Red').setTitle('Emoji Deleted').setDescription(`:${emoji.name}: (${emoji.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildEmojiUpdate, async (oldE, newE) => {
    const ch = getLogChannel(newE.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(newE.guild, AuditLogEvent.EmojiUpdate, newE.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Emoji Updated').setDescription(`:${oldE.name} → :${newE.name}: (${newE.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });

  client.on(Events.GuildStickerCreate, async sticker => {
    const ch = getLogChannel(sticker.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Sticker Created').setDescription(`${sticker.name} (${sticker.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildStickerDelete, async sticker => {
    const ch = getLogChannel(sticker.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
    const embed = new EmbedBuilder().setColor('Red').setTitle('Sticker Deleted').setDescription(`${sticker.name} (${sticker.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
  client.on(Events.GuildStickerUpdate, async (oldS, newS) => {
    const ch = getLogChannel(newS.guild, client.db); if (!ch) return;
    const entry = await tryFetchAudit(newS.guild, AuditLogEvent.StickerUpdate, newS.id);
    const embed = new EmbedBuilder().setColor('Blurple').setTitle('Sticker Updated').setDescription(`${oldS.name} → ${newS.name} (${newS.id})`).setTimestamp();
    const by = buildModLine(entry); if (by) embed.addFields({ name: 'By', value: by });
    ch.send({ embeds: [embed] }).catch(() => {});
  });
};
