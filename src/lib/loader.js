const fs = require('fs');
const path = require('path');
const { Events, PermissionFlagsBits } = require('discord.js');

async function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const folders = fs.readdirSync(commandsPath);
  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        // Attach category for help command
        command.category = folder;
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      }
    }
  }
  client.applicationCommandsData = commands;
}

function registerInteractions(client) {
  client.on(Events.InteractionCreate, async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        // Admin gating if command declares adminOnly
        if (command.adminOnly) {
          const { getGuildConfig } = require('./db');
          const cfg = getGuildConfig(client.db, interaction.guildId);
          const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (cfg?.admin_role_id && interaction.member.roles.cache.has(cfg.admin_role_id));
          if (!isAdmin) return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        await command.execute(interaction, client);
      } else if (interaction.isButton()) {
        const customId = interaction.customId;
        // Route ticket and verification buttons
        if (customId.startsWith('ticket:')) {
          const mod = require('../commands/mod/ticket');
          await mod.handleButton(interaction, client);
        } else if (customId.startsWith('verify:')) {
          const mod = require('../commands/mod/verify');
          await mod.handleButton(interaction, client);
        }
      } else if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        if (customId.startsWith('embed:')) {
          const mod = require('../commands/mod/embed');
          await mod.handleModal(interaction, client);
        } else if (customId.startsWith('ticket:')) {
          const mod = require('../commands/mod/ticket');
          await mod.handleModal(interaction, client);
        } else if (customId.startsWith('verify:')) {
          const mod = require('../commands/mod/verify');
          await mod.handleModal(interaction, client);
        } else if (customId.startsWith('rr:')) {
          const util = require('../commands/util/reactroles');
          await util.handleModal(interaction, client);
        }
      }
    } catch (err) {
      console.error('Interaction error:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: 'There was an error executing this interaction.', ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: 'There was an error executing this interaction.', ephemeral: true }).catch(() => {});
      }
    }
  });
}

module.exports = { loadCommands, registerInteractions };
