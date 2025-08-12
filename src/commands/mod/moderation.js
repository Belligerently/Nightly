const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../lib/db');
function logModAction(interaction, action, details) {
  const cfg = getGuildConfig(interaction.client.db, interaction.guildId);
  if (!cfg?.log_channel_id) return;
  const ch = interaction.guild.channels.cache.get(cfg.log_channel_id);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor('Blurple')
    .setTitle(`Mod Action: ${action}`)
    .setDescription(details)
    .setTimestamp()
    .setFooter({ text: `By ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
  ch.send({ embeds: [embed] }).catch(() => {});
}
const ms = (str) => {
  // simple ms parser for inputs like 10m, 2h, 1d
  const m = /^\s*(\d+)\s*([smhd])?\s*$/i.exec(str || '');
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'm').toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return n * mult;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation commands')
    .addSubcommand(sc => sc.setName('kick').setDescription('Kick a member')
      .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )
    .addSubcommand(sc => sc.setName('ban').setDescription('Ban a member')
      .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
      .addIntegerOption(o => o.setName('days').setDescription('Delete previous days of messages (0-7)'))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )
    .addSubcommand(sc => sc.setName('unban').setDescription('Unban a user')
      .addStringOption(o => o.setName('userid').setDescription('User ID to unban').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('softban').setDescription('Softban a member (ban then unban to clear messages)')
      .addUserOption(o => o.setName('user').setDescription('Member to softban').setRequired(true))
      .addIntegerOption(o => o.setName('days').setDescription('Delete previous days of messages (0-7)'))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )
    .addSubcommand(sc => sc.setName('timeout').setDescription('Timeout a member')
      .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration (e.g., 10m, 2h)').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
    )
    .addSubcommand(sc => sc.setName('untimeout').setDescription('Remove timeout from a member')
      .addUserOption(o => o.setName('user').setDescription('Member to untimeout').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('purge').setDescription('Bulk delete messages in this channel')
      .addIntegerOption(o => o.setName('count').setDescription('Number of messages (max 100)').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('cleanuser').setDescription('Delete recent messages from a user in this channel')
      .addUserOption(o => o.setName('user').setDescription('User to clean').setRequired(true))
      .addIntegerOption(o => o.setName('count').setDescription('Number of messages to remove (max 100)').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('slowmode').setDescription('Set channel slowmode in seconds (0 to disable)')
      .addIntegerOption(o => o.setName('seconds').setDescription('Seconds').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('nick').setDescription('Set a member nickname')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('New nickname').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('clearnick').setDescription('Reset a member\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    )
    .addSubcommand(sc => sc.setName('lock').setDescription('Lock the current channel'))
    .addSubcommand(sc => sc.setName('unlock').setDescription('Unlock the current channel'))
    .addSubcommand(sc => sc.setName('banlist').setDescription('List recent banned users'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers | PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.BanMembers | PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    try {
      if (sub === 'kick') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await guild.members.fetch(user.id);
        await member.kick(reason);
        logModAction(interaction, 'Kick', `User: ${user.tag} (${user.id})\nReason: ${reason}`);
        return interaction.reply({ content: `Kicked ${user.tag}.`, ephemeral: true });
      }
      if (sub === 'ban') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('days') ?? 0;
        await guild.members.ban(user.id, { reason, deleteMessageDays: Math.min(Math.max(days, 0), 7) });
        logModAction(interaction, 'Ban', `User: ${user.tag} (${user.id})\nReason: ${reason}\nDelete Days: ${days}`);
        return interaction.reply({ content: `Banned ${user.tag}.`, ephemeral: true });
      }
      if (sub === 'softban') {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('days') ?? 1;
        await guild.members.ban(user.id, { reason: `[Softban] ${reason}`, deleteMessageDays: Math.min(Math.max(days, 0), 7) });
        await guild.bans.remove(user.id, 'Softban unban');
        logModAction(interaction, 'Softban', `User: ${user.tag} (${user.id})\nReason: ${reason}\nDelete Days: ${days}`);
        return interaction.reply({ content: `Softbanned ${user.tag}.`, ephemeral: true });
      }
      if (sub === 'unban') {
        const userId = interaction.options.getString('userid', true);
        await guild.bans.remove(userId).catch(() => {});
        logModAction(interaction, 'Unban', `User ID: ${userId}`);
        return interaction.reply({ content: `Unbanned ${userId}.`, ephemeral: true });
      }
      if (sub === 'timeout') {
        const user = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration', true);
        const parseMs = ms(duration);
        if (!parseMs) return interaction.reply({ content: 'Invalid duration. Use formats like 10m, 2h, 1d.', ephemeral: true });
        const member = await guild.members.fetch(user.id);
        await member.timeout(parseMs, interaction.options.getString('reason') || 'No reason provided');
        logModAction(interaction, 'Timeout', `User: ${user.tag} (${user.id})\nDuration: ${duration}`);
        return interaction.reply({ content: `Timed out ${user.tag} for ${duration}.`, ephemeral: true });
      }
      if (sub === 'untimeout') {
        const user = interaction.options.getUser('user', true);
        const member = await guild.members.fetch(user.id);
        await member.timeout(null).catch(() => {});
        logModAction(interaction, 'Untimeout', `User: ${user.tag} (${user.id})`);
        return interaction.reply({ content: `Removed timeout from ${user.tag}.`, ephemeral: true });
      }
      if (sub === 'purge') {
        const count = Math.min(Math.max(interaction.options.getInteger('count', true), 1), 100);
        const msgs = await interaction.channel.bulkDelete(count, true);
        logModAction(interaction, 'Purge', `Channel: ${interaction.channel}\nMessages deleted: ${msgs.size}`);
        return interaction.reply({ content: `Deleted ${msgs.size} messages.`, ephemeral: true });
      }
      if (sub === 'cleanuser') {
        const target = interaction.options.getUser('user', true);
        const count = Math.min(Math.max(interaction.options.getInteger('count', true), 1), 100);
        const fetched = await interaction.channel.messages.fetch({ limit: 100 });
        const toDelete = fetched.filter(m => m.author?.id === target.id).first(count);
        let deleted = 0;
        if (toDelete && toDelete.length) {
          const res = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
          deleted = res?.size ?? toDelete.length;
        }
        logModAction(interaction, 'CleanUser', `Channel: ${interaction.channel}\nUser: ${target.tag} (${target.id})\nMessages deleted: ${deleted}`);
        return interaction.reply({ content: `Deleted ${deleted} messages from ${target.tag}.`, ephemeral: true });
      }
      if (sub === 'slowmode') {
        const seconds = Math.max(interaction.options.getInteger('seconds', true), 0);
        await interaction.channel.setRateLimitPerUser(seconds).catch(() => {});
        logModAction(interaction, 'Slowmode', `Channel: ${interaction.channel}\nSeconds: ${seconds}`);
        return interaction.reply({ content: `Slowmode set to ${seconds}s.`, ephemeral: true });
      }
      if (sub === 'nick') {
        const user = interaction.options.getUser('user', true);
        const nickname = interaction.options.getString('nickname', true);
        const member = await guild.members.fetch(user.id);
        await member.setNickname(nickname).catch(() => {});
        logModAction(interaction, 'Nick', `User: ${user.tag} (${user.id})\nNew nickname: ${nickname}`);
        return interaction.reply({ content: `Nickname updated.`, ephemeral: true });
      }
      if (sub === 'clearnick') {
        const user = interaction.options.getUser('user', true);
        const member = await guild.members.fetch(user.id);
        await member.setNickname(null).catch(() => {});
        logModAction(interaction, 'ClearNick', `User: ${user.tag} (${user.id})`);
        return interaction.reply({ content: `Nickname cleared.`, ephemeral: true });
      }
      if (sub === 'lock') {
        const everyone = guild.roles.everyone;
        await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: false });
        logModAction(interaction, 'Lock', `Channel: ${interaction.channel}`);
        return interaction.reply({ content: 'Channel locked.', ephemeral: true });
      }
      if (sub === 'unlock') {
        const everyone = guild.roles.everyone;
        await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: true });
        logModAction(interaction, 'Unlock', `Channel: ${interaction.channel}`);
        return interaction.reply({ content: 'Channel unlocked.', ephemeral: true });
      }
      if (sub === 'banlist') {
        const bans = await guild.bans.fetch();
        const list = [...bans.values()].slice(0, 20).map(b => `${b.user.tag} (${b.user.id})`).join('\n');
        const content = list || 'No bans.';
        return interaction.reply({ content, ephemeral: true });
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: 'Action failed. Check my permissions and role position.', ephemeral: true });
    }
  }
};
