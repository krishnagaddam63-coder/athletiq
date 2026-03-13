const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { createClient } = require('@libsql/client');

// ─── Optional Twilio SMS ───────────────────────────────────────────────────
async function sendSmsViaProvider(to, message) {
  console.log(`\n📱 [SMS → ${to}] ${message}\n`);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Turso Database Client ─────────────────────────────────────────────────
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// ─── Initialize Tables ────────────────────────────────────────────────────
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      password        TEXT NOT NULL,
      security_answer TEXT NOT NULL DEFAULT '',
      plain_password  TEXT NOT NULL DEFAULT '',
      phone           TEXT NOT NULL DEFAULT '',
      is_public       INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS schedules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL,
      sport          TEXT NOT NULL,
      drill_title    TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      notified       INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('✅ Turso database tables ready.');
}

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Auth Routes ──────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, security_answer, phone } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!security_answer || security_answer.trim().length < 1)
    return res.status(400).json({ error: 'Security answer is required.' });
  if (!phone || phone.trim().length < 1)
    return res.status(400).json({ error: 'Phone number is required.' });

  try {
    const hashedPass   = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(security_answer.trim().toLowerCase(), 10);

    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password, security_answer, plain_password, phone) VALUES (?, ?, ?, ?, ?, ?)',
      args: [name, email.toLowerCase(), hashedPass, hashedAnswer, '', phone.trim()]
    });

    res.status(201).json({ message: 'Account created successfully!', userId: Number(result.lastInsertRowid) });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, security_answer } = req.body;
  if (!email || !security_answer)
    return res.status(400).json({ error: 'Email and security answer are required.' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No account found with that email.' });

    const match = await bcrypt.compare(security_answer.trim().toLowerCase(), user.security_answer);
    if (!match) return res.status(401).json({ error: 'Incorrect answer. Please try again.' });

    res.json({ message: 'Identity verified.', userId: Number(user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword)
    return res.status(400).json({ error: 'User ID and new password are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const hashedPass = await bcrypt.hash(newPassword, 10);
    const result = await db.execute({
      sql: "UPDATE users SET password = ?, plain_password = '' WHERE id = ?",
      args: [hashedPass, userId]
    });
    if (result.rowsAffected === 0)
      return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Password reset successful! You can now sign in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    res.json({
      message: 'Login successful!',
      user: {
        id: Number(user.id),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        is_public: user.is_public || 0,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// GET /api/db/schema
app.get('/api/db/schema', async (req, res) => {
  try {
    const countResult = await db.execute('SELECT COUNT(*) AS total FROM users');
    const usersResult = await db.execute('SELECT id, name, email, phone, created_at FROM users ORDER BY id');
    const users = usersResult.rows.map(u => ({
      ...u,
      id: Number(u.id),
      password: '[ENCRYPTED]',
      security_answer: '[ENCRYPTED]',
      plain_password: '[REMOVED]'
    }));
    res.json({ table: 'users', total_users: Number(countResult.rows[0].total), users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/db/users
app.get('/api/db/users', async (req, res) => {
  try {
    const result = await db.execute('SELECT id, name, email, phone, created_at FROM users ORDER BY id');
    const users = result.rows.map(u => ({
      ...u,
      id: Number(u.id),
      password: '[ENCRYPTED]',
      security_answer: '[ENCRYPTED]',
      plain_password: '[REMOVED]'
    }));
    res.json({ total: users.length, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Schedules API ──────────────────────────────────────────────

// POST /api/schedules
app.post('/api/schedules', async (req, res) => {
  const { user_id, sport, title, scheduled_time } = req.body;
  if (!user_id || !sport || !title || !scheduled_time)
    return res.status(400).json({ error: 'All fields are required to schedule a drill.' });

  try {
    const result = await db.execute({
      sql: 'INSERT INTO schedules (user_id, sport, drill_title, scheduled_time, notified) VALUES (?, ?, ?, ?, 0)',
      args: [user_id, sport, title, scheduled_time]
    });
    res.json({ message: 'Drill scheduled successfully!', id: Number(result.lastInsertRowid) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule drill' });
  }
});

// GET /api/schedules/:userId
app.get('/api/schedules/:userId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, user_id, sport, drill_title AS title, scheduled_time, notified FROM schedules WHERE user_id = ? ORDER BY scheduled_time ASC',
      args: [req.params.userId]
    });
    res.json(result.rows.map(r => ({ ...r, id: Number(r.id), user_id: Number(r.user_id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// GET /api/reports/:userId
app.get('/api/reports/:userId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM schedules WHERE user_id = ? AND scheduled_time >= datetime('now', '-7 days')",
      args: [req.params.userId]
    });
    const schedules = result.rows;
    const totalSchedules = schedules.length;
    let sportsCount = {};
    schedules.forEach(s => { sportsCount[s.sport] = (sportsCount[s.sport] || 0) + 1; });

    let reportText = `You scheduled ${totalSchedules} drills this week. `;
    reportText += totalSchedules > 0
      ? 'Great consistency! Keep pushing your limits.'
      : "Let's get back on track. Try scheduling a drill today!";

    res.json({ total: totalSchedules, breakdown: sportsCount, summary: reportText });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─── SMS Reminder API ─────────────────────────────────────────────────────
app.post('/api/send-sms', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message)
    return res.status(400).json({ error: 'Phone and message are required.' });
  try {
    await sendSmsViaProvider(phone, message);
    res.json({ message: 'SMS sent successfully.', to: phone });
  } catch (err) {
    console.error('SMS send error:', err.message);
    res.status(500).json({ error: 'Failed to send SMS.' });
  }
});

// GET /db
app.get('/db', (req, res) => {
  res.sendFile(path.join(__dirname, 'db_viewer.html'));
});

// ─── Start ────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 AthletiQ server running at http://localhost:${PORT}`);
    console.log(`📋 DB Schema:  http://localhost:${PORT}/api/db/schema`);
    console.log(`🌐 Website:    http://localhost:${PORT}/index.html\n`);

    // ─── SMS Reminder Scheduler (every 60s) ───────────────────
    setInterval(async () => {
      try {
        const now   = new Date();
        const in30  = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        const in31  = new Date(now.getTime() + 31 * 60 * 1000).toISOString();

        const result = await db.execute({
          sql: `SELECT s.id, s.drill_title AS title, s.sport, s.scheduled_time,
                       u.name AS user_name, u.phone AS user_phone
                FROM   schedules s JOIN users u ON u.id = s.user_id
                WHERE  s.notified = 0
                  AND  s.scheduled_time >= ?
                  AND  s.scheduled_time <= ?`,
          args: [in30, in31]
        });

        for (const drill of result.rows) {
          if (!drill.user_phone) continue;
          const schedTime = new Date(drill.scheduled_time);
          const timeStr = schedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          const dateStr = schedTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const smsMsg = `AthletiQ 🏆: Hi ${drill.user_name}! Your ${drill.sport} drill "${drill.title}" starts in 30 min at ${timeStr} on ${dateStr}. Get ready! 💪`;

          try {
            await sendSmsViaProvider(drill.user_phone, smsMsg);
            await db.execute({ sql: 'UPDATE schedules SET notified = 1 WHERE id = ?', args: [drill.id] });
            console.log(`✅ Reminder sent to ${drill.user_phone} for "${drill.title}"`);
          } catch (smsErr) {
            console.error(`❌ SMS failed for drill ${drill.id}:`, smsErr.message);
          }
        }
      } catch (err) {
        console.error('Scheduler error:', err.message);
      }
    }, 60 * 1000);
  });
}).catch(err => {
  console.error('❌ Failed to connect to Turso database:', err.message);
  process.exit(1);
});
