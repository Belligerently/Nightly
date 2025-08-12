require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function collectCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const folders = fs.readdirSync(commandsPath);
  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const cmd = require(path.join(folderPath, file));
      if (cmd?.data) commands.push(cmd.data.toJSON());
    }
  }
  return commands;
}

(async () => {
  const TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;
  const GUILD_ID = process.env.GUILD_ID; // optional for guild-scoped

  if (!TOKEN || !CLIENT_ID) {
    console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = await collectCommands();

  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
      console.log(`Deployed ${body.length} commands to guild ${GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
      console.log(`Deployed ${body.length} global commands.`);
    }
  } catch (e) {
    console.error(e);
  }
})();
