const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { getGuildConfig, createTicketPanel, getTicketPanelByToken, insertTicket, closeTicket } = require('../../lib/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket setup and management')
    .addSubcommand(sc => sc
      .setName('panel')
      .setDescription('Create a ticket panel (opens a popup to customize)'))
    .addSubcommand(sc => sc
      .setName('close')
      .setDescription('Close the current ticket channel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      const modal = new ModalBuilder().setCustomId('ticket:panelModal').setTitle('Create Ticket Panel');
      const pTitle = new TextInputBuilder().setCustomId('pTitle').setLabel('Panel Title').setStyle(TextInputStyle.Short).setRequired(true);
      const pDesc = new TextInputBuilder().setCustomId('pDesc').setLabel('Panel Description').setStyle(TextInputStyle.Paragraph).setRequired(true);
      const pColor = new TextInputBuilder().setCustomId('pColor').setLabel('Panel Color (hex, optional)').setStyle(TextInputStyle.Short).setRequired(false);
      const btnLabel = new TextInputBuilder().setCustomId('btnLabel').setLabel('Button Label').setStyle(TextInputStyle.Short).setRequired(false);
  const welcomeConfig = new TextInputBuilder().setCustomId('welcomeConfig').setLabel('Welcome JSON (title, desc, color, close)').setStyle(TextInputStyle.Paragraph).setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(pTitle),
        new ActionRowBuilder().addComponents(pDesc),
        new ActionRowBuilder().addComponents(pColor),
        new ActionRowBuilder().addComponents(btnLabel),
        new ActionRowBuilder().addComponents(welcomeConfig)
      );
      await interaction.showModal(modal);
      return;
    }

    if (sub === 'close') {
      if (!interaction.channel?.name?.startsWith('ticket-')) return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
      // Build transcript and send to configured channel, then delete ticket channel
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });
        const lines = [...msgs.values()].reverse().map(m => {
          const time = new Date(m.createdTimestamp).toISOString();
          const author = m.author?.tag || 'Unknown';
          const content = m.content || '';
          return `[${time}] ${author}: ${content}`;
        }).join('\n');
        const buffer = Buffer.from(lines, 'utf8');
        const cfg = getGuildConfig(interaction.client.db, interaction.guildId);
        const txId = cfg?.transcript_channel_id;
        if (txId) {
          const ch = await interaction.guild.channels.fetch(txId).catch(() => null);
          if (ch?.isTextBased()) {
            await ch.send({ content: `Transcript for ${interaction.channel.name}`, files: [{ attachment: buffer, name: `${interaction.channel.name}-transcript.txt` }] });
          }
        }
      } catch (e) {
        console.error('Transcript error:', e);
      }
      try { closeTicket(interaction.client.db, interaction.channel.id); } catch (_) {}
      await interaction.reply({ content: 'Ticket closed. Deleting channel…', ephemeral: true }).catch(() => {});
      await interaction.channel.delete('Ticket closed');
    }
  },
  async handleButton(interaction, client) {
    const id = interaction.customId;
    if (id.startsWith('ticket:open:')) {
      const token = id.split(':')[2];
      const panel = getTicketPanelByToken(client.db, token);
      const cfg = getGuildConfig(client.db, interaction.guildId);
      const categoryId = cfg?.ticket_category_id;
      const staffRoleId = cfg?.staff_role_id;
      // Compute next incremental ticket number per guild
      let ticketNumber = 1;
      try {
        const row = client.db.prepare('SELECT IFNULL(MAX(id), 0) + 1 AS next FROM tickets WHERE guild_id = ?').get(interaction.guildId);
        ticketNumber = row?.next || 1;
      } catch (_) {}
      const name = `ticket-${ticketNumber}`;
      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
      ];
      if (staffRoleId) {
        overwrites.push({ id: staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
      }
      try {
        const channel = await interaction.guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: categoryId || undefined,
          permissionOverwrites: overwrites
        });
        // Send a plain ping message first (outside the embed)
        const mentionContent = `${interaction.user}${staffRoleId ? ` <@&${staffRoleId}>` : ''}`;
        await channel.send({
          content: mentionContent,
          allowedMentions: { parse: [], users: [interaction.user.id], roles: staffRoleId ? [staffRoleId] : [] }
        });
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(panel?.welcome_title || 'Welcome')
          .setDescription(((panel?.welcome_description) || 'Welcome {user}, a team member will be with you shortly.').replace('{user}', `${interaction.user}`))
          .setColor(panel?.welcome_color || '#5865F2');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket:close').setLabel(panel?.close_label || 'Close Ticket').setStyle(ButtonStyle.Danger)
        );
        await channel.send({ embeds: [welcomeEmbed], components: [row], allowedMentions: { parse: [] } });
        try { insertTicket(client.db, { guild_id: interaction.guildId, channel_id: channel.id, user_id: interaction.user.id }); } catch (_) {}
        await interaction.reply({ content: `Created ${channel}`, ephemeral: true });
      } catch (e) {
        console.error(e);
        await interaction.reply({ content: 'Could not create a ticket channel. Check my permissions and config.', ephemeral: true });
      }
    } else if (id === 'ticket:close') {
      if (!interaction.channel || !interaction.channel.name?.startsWith('ticket-')) {
        return interaction.reply({ content: 'This is not a ticket channel.', ephemeral: true });
      }
      // Build transcript and send to configured channel, then delete ticket channel
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 100 });
        const lines = [...msgs.values()].reverse().map(m => {
          const time = new Date(m.createdTimestamp).toISOString();
          const author = m.author?.tag || 'Unknown';
          const content = m.content || '';
          return `[${time}] ${author}: ${content}`;
        }).join('\n');
        const buffer = Buffer.from(lines, 'utf8');
        const cfg = getGuildConfig(client.db, interaction.guildId);
        const txId = cfg?.transcript_channel_id;
        if (txId) {
          const ch = await interaction.guild.channels.fetch(txId).catch(() => null);
          if (ch?.isTextBased()) {
            await ch.send({ content: `Transcript for ${interaction.channel.name}`, files: [{ attachment: buffer, name: `${interaction.channel.name}-transcript.txt` }] });
          }
        }
      } catch (e) {
        console.error('Transcript error:', e);
      }
      try { closeTicket(client.db, interaction.channel.id); } catch (_) {}
      await interaction.reply({ content: 'Ticket closed. Deleting channel…', ephemeral: true }).catch(() => {});
      await interaction.channel.delete('Ticket closed');
    }
  },
  async handleModal(interaction, client) {
    if (interaction.customId === 'ticket:panelModal') {
      const pTitle = interaction.fields.getTextInputValue('pTitle');
      const pDesc = interaction.fields.getTextInputValue('pDesc');
      const pColor = interaction.fields.getTextInputValue('pColor') || '#5865F2';
      const btnLabel = interaction.fields.getTextInputValue('btnLabel') || 'Open Ticket';
      const welcomeJson = interaction.fields.getTextInputValue('welcomeConfig');
      let wTitle = 'Welcome';
      let wDesc = 'Welcome {user}, a team member will be with you shortly.';
      let wColor = '#5865F2';
      let cLabel = 'Close Ticket';
      if (welcomeJson) {
        try {
          const o = JSON.parse(welcomeJson);
          wTitle = o.title || wTitle;
          wDesc = o.description || wDesc;
          wColor = o.color || wColor;
          cLabel = o.closeLabel || cLabel;
        } catch (_) {}
      }
      const panelToken = `${interaction.guildId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

      createTicketPanel(client.db, {
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        token: panelToken,
        panel_title: pTitle,
        panel_description: pDesc,
        panel_color: pColor,
        button_label: btnLabel,
        welcome_title: wTitle,
        welcome_description: wDesc,
        welcome_color: wColor,
        close_label: cLabel
      });

      const embed = new EmbedBuilder().setTitle(pTitle).setDescription(pDesc).setColor(pColor);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket:open:${panelToken}`).setLabel(btnLabel).setStyle(ButtonStyle.Primary)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
    }
  }
};
