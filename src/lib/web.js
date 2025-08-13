const express = require('express');

function startAdminServer({ client, db, port = 3000, adminKey = '' }) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Simple key auth middleware
  app.use((req, res, next) => {
    if (!adminKey) return res.status(500).send('ADMIN_KEY not set');
    const key = req.headers['x-admin-key'] || req.query.key || (req.body && req.body.key);
    if (key !== adminKey) return res.status(401).send('Unauthorized');
    next();
  });

  // Views
  app.get('/', (req, res) => {
    const pending = db.prepare('SELECT * FROM pending_guilds ORDER BY joined_at DESC').all();
    const approved = db.prepare('SELECT * FROM approved_guilds ORDER BY approved_at DESC').all();
    const html = `
      <html>
        <head>
          <title>Guild Approvals</title>
          <style>
            body{font-family:system-ui,Segoe UI,Arial;margin:20px;}
            h1{margin-bottom:0}
            table{border-collapse:collapse;width:100%;margin:12px 0}
            th,td{border:1px solid #ddd;padding:8px}
            th{background:#f5f5f5;text-align:left}
            .row-actions{display:flex;gap:8px}
            input[type=text]{padding:6px}
            .hint{color:#666}
          </style>
        </head>
        <body>
          <h1>Guild Approvals</h1>
          <p class="hint">Include ?key=YOUR_ADMIN_KEY in the URL or set X-Admin-Key header.</p>

          <h2>Pending</h2>
          <table>
            <tr><th>Guild ID</th><th>Name</th><th>Owner</th><th>Joined</th><th>Actions</th></tr>
            ${pending.map(p => `
              <tr>
                <td>${p.guild_id}</td>
                <td>${p.name || ''}</td>
                <td>${p.owner_tag || p.owner_id || ''}</td>
                <td>${new Date(p.joined_at).toLocaleString()}</td>
                <td class="row-actions">
                  <form method="POST" action="/approve?key=${encodeURIComponent(adminKey)}">
                    <input type="hidden" name="guild_id" value="${p.guild_id}" />
                    <input type="text" name="note" placeholder="note (optional)" />
                    <button type="submit">Approve</button>
                  </form>
                  <form method="POST" action="/deny?key=${encodeURIComponent(adminKey)}">
                    <input type="hidden" name="guild_id" value="${p.guild_id}" />
                    <button type="submit">Deny</button>
                  </form>
                </td>
              </tr>
            `).join('')}
          </table>

          <h2>Approved</h2>
          <table>
            <tr><th>Guild ID</th><th>Note</th><th>Approved At</th><th>Actions</th></tr>
            ${approved.map(a => `
              <tr>
                <td>${a.guild_id}</td>
                <td>${a.note || ''}</td>
                <td>${new Date(a.approved_at).toLocaleString()}</td>
                <td class="row-actions">
                  <form method="POST" action="/deny?key=${encodeURIComponent(adminKey)}">
                    <input type="hidden" name="guild_id" value="${a.guild_id}" />
                    <button type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            `).join('')}
          </table>
        </body>
      </html>
    `;
    res.type('html').send(html);
  });

  app.post('/approve', (req, res) => {
    const { guild_id, note } = req.body || {};
    if (!guild_id) return res.status(400).send('guild_id required');
    db.prepare(`INSERT INTO approved_guilds (guild_id, approved_at, note)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id) DO UPDATE SET approved_at = excluded.approved_at, note = excluded.note`).run(guild_id, Date.now(), note || null);
    db.prepare('DELETE FROM pending_guilds WHERE guild_id = ?').run(guild_id);
    res.redirect(`/?key=${encodeURIComponent(adminKey)}`);
  });

  app.post('/deny', (req, res) => {
    const { guild_id } = req.body || {};
    if (!guild_id) return res.status(400).send('guild_id required');
    db.prepare('DELETE FROM pending_guilds WHERE guild_id = ?').run(guild_id);
    db.prepare('DELETE FROM approved_guilds WHERE guild_id = ?').run(guild_id);
    res.redirect(`/?key=${encodeURIComponent(adminKey)}`);
  });

  app.listen(port, () => {
    console.log(`[admin] Guild approval web UI listening on http://localhost:${port}`);
  });
}

module.exports = startAdminServer;
