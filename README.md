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

## Permissions
- Use `/setconfig adminrole` to set an admin role. Users with that role (or server Admin permission) can run admin-only commands.

## Data
- SQLite database at `data/bot.db` will be created automatically.
