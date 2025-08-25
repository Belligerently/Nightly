# Nightly Bot

Discord moderation bot with logging, tickets, verification, embeds, role management, and admin access control. Built with discord.js v14 and SQLite.

## Features
- Slash commands
- Configurable log channel, ticket category, verification role, and admin role: `/setconfig`
- Ticket system: `/ticket panel`, `/ticket close`
- Verification panel: `/verify panel`
- Embed builder: `/embed`
- Role add/remove: `/role add/remove`
- Ping: `/ping`

## How to use

Option 1: Contact me on Discord at "shallow." and I can host the bot for you! In the future a site will be made to do this as well!

Option 2: Self Hosting the bot

## Setup
1. Install Node.js 18+.
2. Create a bot at the Discord Developer Portal and get the token and client ID.
3. Clone or copy this folder.
4. Create `.env` from `.env.example` and fill values.
5. Install deps.

```powershell
# from the workspace root
cd "c:\Nightly bot"
npm install
npm start
```

- Commands are registered automatically per guild on startup and when the bot joins a new guild.
- Make sure the bot has permissions and intents (Guild Members intent) enabled in the portal.

## Guilds
The bot registers slash commands per guild on startup and when it joins new guilds.

Avoid duplicates:
- Don’t deploy global slash commands if you use per-guild registration.
- If you previously used scripts/deploy-commands.js without GUILD_ID (global), duplicates can appear. On startup the bot now clears any global commands automatically.

## Permissions
- Use `/setconfig adminrole` to set an admin role. Users with that role (or server Admin permission) can run admin-only commands.

## Data
- SQLite database at `data/bot.db` will be created automatically.
