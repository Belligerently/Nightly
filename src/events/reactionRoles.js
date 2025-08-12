const { Events } = require('discord.js');
const { getReactionRole } = require('../lib/db');

module.exports = function registerReactionRoles(client) {
  const resolveKey = reaction => {
    if (!reaction.emoji) return null;
    if (reaction.emoji.id) return reaction.emoji.id; // custom emoji id
    return reaction.emoji.name; // unicode
  };

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (user.bot || !reaction.message.guild) return;
      if (reaction.partial) await reaction.fetch();
      const key = resolveKey(reaction);
      if (!key) return;
      const map = getReactionRole(client.db, reaction.message.guild.id, reaction.message.id, key);
      if (!map) return;
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
      await member.roles.add(map.role_id).catch(() => {});
    } catch (e) { console.error('RR add error', e); }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      if (user.bot || !reaction.message.guild) return;
      if (reaction.partial) await reaction.fetch();
      const key = resolveKey(reaction);
      if (!key) return;
      const map = getReactionRole(client.db, reaction.message.guild.id, reaction.message.id, key);
      if (!map) return;
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
      await member.roles.remove(map.role_id).catch(() => {});
    } catch (e) { console.error('RR remove error', e); }
  });
};
