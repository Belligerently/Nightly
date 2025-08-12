require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const { initDb, maybeRestoreGuildConfigs } = require('./lib/db');
const { loadCommands, registerInteractions } = require('./lib/loader');
const registerLogging = require('./events/logging');
const registerReactionRoles = require('./events/reactionRoles');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.commands = new Collection();
client.cooldowns = new Collection();

(async () => {
  // Init DB
  const db = initDb();
  client.db = db;
  // Restore guild config snapshot if DB is empty
  try { const restored = maybeRestoreGuildConfigs(db); if (restored) console.log(`Restored ${restored} guild config(s) from snapshot.`); } catch (_) {}

  // Load commands
  await loadCommands(client);
  registerInteractions(client);
  registerLogging(client);
  registerReactionRoles(client);

  client.once(Events.ClientReady, async c => {
    console.log(`Logged in as ${c.user.tag}`);
    // Per-guild command registration (fast and no client ID needed)
    const cmds = client.applicationCommandsData || [];
    let count = 0;
    for (const [id, guild] of client.guilds.cache) {
      try {
        await guild.commands.set(cmds);
        count++;
      } catch (e) {
        console.error(`Failed to register commands for guild ${guild.name} (${id})`, e);
      }
    }
    console.log(`Registered ${cmds.length} commands in ${count} guild(s).`);

    // RAM monitor: log to console every 60s (no Discord presence)
    const formatMB = bytes => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    const updateRam = () => {
      const mem = process.memoryUsage();
      const rss = formatMB(mem.rss);
      const heapUsed = formatMB(mem.heapUsed);
      console.log(`[RAM] rss=${rss}, heapUsed=${heapUsed}`);
    };
    updateRam();
    if (!client.__ramInterval) client.__ramInterval = setInterval(updateRam, 60_000);
  });

  client.on(Events.GuildCreate, async guild => {
    try {
      const cmds = client.applicationCommandsData || [];
      await guild.commands.set(cmds);
      console.log(`Registered ${cmds.length} commands in new guild ${guild.name}.`);
    } catch (e) {
      console.error('GuildCreate registration failed:', e);
    }
  });

  const token = (process.env.DISCORD_TOKEN || '').trim();
  if (!token) {
    console.error('DISCORD_TOKEN is not set in .env. Please add your bot token and restart.');
    process.exit(1);
  }
  client.login(token);
})();
