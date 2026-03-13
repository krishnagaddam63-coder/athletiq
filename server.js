const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');

// ─── Optional Twilio SMS (set env vars to enable) ─────────────────────────
// To activate real SMS: set env vars TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
// then `npm install twilio` and uncomment the block below.
/*
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
async function sendSmsViaProvider(to, message) {
  await twilioClient.messages.create({ body: message, from: process.env.TWILIO_FROM, to });
}
*/
async function sendSmsViaProvider(to, message) {
  // Placeholder — replace with real SMS provider (Twilio, MSG91, Fast2SMS, etc.)
  console.log(`\n📱 [SMS → ${to}] ${message}\n`);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Database ────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Ensure users table exists (with security question support)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    email            TEXT NOT NULL UNIQUE,
    password         TEXT NOT NULL,
    security_answer  TEXT NOT NULL DEFAULT '',
    plain_password   TEXT NOT NULL DEFAULT '',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add columns if upgrading an existing DB (safe to run multiple times)
try { db.exec(`ALTER TABLE users ADD COLUMN security_answer TEXT NOT NULL DEFAULT ''`); } catch(_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN plain_password  TEXT NOT NULL DEFAULT ''`); } catch(_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''`); } catch(_) {}
// Create schedules table for user notifications
db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sport TEXT NOT NULL,
    drill_title TEXT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    notified INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // Serve all static HTML/CSS/JS

// ─── Auth Routes ──────────────────────────────────────────────

// POST /api/auth/register  — Create a new user
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, security_answer, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!security_answer || security_answer.trim().length < 1) {
    return res.status(400).json({ error: 'Security answer is required.' });
  }
  if (!phone || phone.trim().length < 1) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    const hashedPass = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(security_answer.trim().toLowerCase(), 10);
    
    const stmt = db.prepare(
      'INSERT INTO users (name, email, password, security_answer, plain_password, phone) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      name,
      email.toLowerCase(),
      hashedPass,
      hashedAnswer,
      '',   // Security update: plain_password is NO LONGER stored
      phone.trim()
    );
    res.status(201).json({
      message: 'Account created successfully!',
      userId: result.lastInsertRowid
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/forgot-password  — Verify security answer & return password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, security_answer } = req.body;
  if (!email || !security_answer) {
    return res.status(400).json({ error: 'Email and security answer are required.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'No account found with that email.' });
  }

  // Security update: security_answer is now hashed
  const match = await bcrypt.compare(security_answer.trim().toLowerCase(), user.security_answer);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect answer. Please try again.' });
  }
  
  // Security update: We NO LONGER return the password. 
  // In a real app, we would return a reset token. 
  // For now, we return success and the userId to allow a reset flow.
  res.json({ message: 'Identity verified.', userId: user.id });
});

// POST /api/auth/reset-password  — Update password for a verified user
app.post('/api/auth/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const hashedPass = await bcrypt.hash(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password = ?, plain_password = \'\' WHERE id = ?');
    const result = stmt.run(hashedPass, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ message: 'Password reset successful! You can now sign in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login  — Authenticate an existing user
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
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

// GET /api/db/schema  — Show the users table schema + masked user records
app.get('/api/db/schema', (req, res) => {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  const count   = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  const users   = db.prepare('SELECT id, name, email, phone, created_at FROM users ORDER BY id').all().map(u => ({
    ...u,
    password: '[ENCRYPTED]',
    security_answer: '[ENCRYPTED]',
    plain_password: '[REMOVED]'
  }));
  res.json({
    table: 'users',
    schema: schema.sql,
    total_users: count.total,
    users
  });
});

// GET /api/db/users  — Return all registered users (fully masked)
app.get('/api/db/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, phone, created_at FROM users ORDER BY id').all().map(u => ({
    ...u,
    password: '[ENCRYPTED]',
    security_answer: '[ENCRYPTED]',
    plain_password: '[REMOVED]'
  }));
  res.json({ total: users.length, users });
});

// ─── Schedules API ──────────────────────────────────────────────

// POST /api/schedules - Schedule a drill
app.post('/api/schedules', (req, res) => {
  const { user_id, sport, title, scheduled_time } = req.body;
  
  if (!user_id || !sport || !title || !scheduled_time) {
    return res.status(400).json({ error: 'All fields are required to schedule a drill.' });
  }
  
  try {
    const stmt = db.prepare('INSERT INTO schedules (user_id, sport, drill_title, scheduled_time, notified) VALUES (?, ?, ?, ?, 0)');
    const result = stmt.run(user_id, sport, title, scheduled_time);
    res.json({ message: 'Drill scheduled successfully!', id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule drill' });
  }
});

// GET /api/schedules/:userId - Get schedules for a user
app.get('/api/schedules/:userId', (req, res) => {
  try {
    const schedules = db.prepare('SELECT id, user_id, sport, drill_title AS title, scheduled_time, notified FROM schedules WHERE user_id = ? ORDER BY scheduled_time ASC').all(req.params.userId);
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// GET /api/reports/:userId - Get weekly report summary
app.get('/api/reports/:userId', (req, res) => {
  try {
    const schedules = db.prepare('SELECT * FROM schedules WHERE user_id = ? AND scheduled_time >= datetime("now", "-7 days")').all(req.params.userId);
    const totalSchedules = schedules.length;
    let sportsCount = {};
    schedules.forEach(s => {
      sportsCount[s.sport] = (sportsCount[s.sport] || 0) + 1;
    });
    
    let reportText = `You scheduled ${totalSchedules} drills this week. `;
    if (totalSchedules > 0) {
      reportText += "Great consistency! Keep pushing your limits.";
    } else {
      reportText += "Let's get back on track. Try scheduling a drill today!";
    }
    
    res.json({
      total: totalSchedules,
      breakdown: sportsCount,
      summary: reportText
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─── SMS Reminder API ─────────────────────────────────────────────────────

// POST /api/send-sms  — Trigger an SMS notification (called by browser or scheduler)
app.post('/api/send-sms', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Phone and message are required.' });
  }
  try {
    await sendSmsViaProvider(phone, message);
    res.json({ message: 'SMS sent successfully.', to: phone });
  } catch (err) {
    console.error('SMS send error:', err.message);
    res.status(500).json({ error: 'Failed to send SMS.' });
  }
});


// GET /db  — Serve the visual database viewer page
app.get('/db', (req, res) => {
  res.sendFile(path.join(__dirname, 'db_viewer.html'));
});


// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AthletiQ server running at http://localhost:${PORT}`);
  console.log(`📋 DB Schema:      http://localhost:${PORT}/api/db/schema`);
  console.log(`🔐 Register:       POST http://localhost:${PORT}/api/auth/register`);
  console.log(`🔑 Login:          POST http://localhost:${PORT}/api/auth/login`);
  console.log(`🌐 Website:        http://localhost:${PORT}/index.html`);
  console.log(`📱 SMS Reminder Scheduler: running (checks every 60s)\n`);

  // ─── Server-side Drill Reminder Scheduler ──────────────────────────────
  // Runs every 60 seconds. Finds scheduled drills that:
  //   • start within the next 30 minutes
  //   • have NOT been notified yet (notified = 0)
  // Then sends an SMS to the user's stored phone number and marks notified = 1.
  setInterval(async () => {
    try {
      const now        = new Date();
      const in30       = new Date(now.getTime() + 30 * 60 * 1000);  // 30 min from now
      const in31       = new Date(now.getTime() + 31 * 60 * 1000);  // +1 min buffer

      // ISO strings for SQLite comparison
      const nowISO  = now.toISOString();
      const in30ISO = in30.toISOString();
      const in31ISO = in31.toISOString();

      // Find unnotified drills coming up in ~30 minutes
      const upcoming = db.prepare(`
        SELECT s.id, s.drill_title AS title, s.sport, s.scheduled_time,
               u.name AS user_name, u.phone AS user_phone
        FROM   schedules s
        JOIN   users u ON u.id = s.user_id
        WHERE  s.notified = 0
          AND  s.scheduled_time >= ?
          AND  s.scheduled_time <= ?
      `).all(in30ISO, in31ISO);

      for (const drill of upcoming) {
        if (!drill.user_phone) {
          console.log(`⚠️  No phone for user "${drill.user_name}" — skipping SMS reminder for "${drill.title}"`);
          continue;
        }

        const schedTime  = new Date(drill.scheduled_time);
        const timeStr    = schedTime.toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true
        });
        const dateStr    = schedTime.toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const smsMessage = `AthletiQ Reminder 🏆: Hi ${drill.user_name}! Your ${drill.sport} drill "${drill.title}" starts in 30 minutes at ${timeStr} on ${dateStr}. Get ready! 💪`;

        try {
          await sendSmsViaProvider(drill.user_phone, smsMessage);
          // Mark this schedule as notified so it never fires again
          db.prepare('UPDATE schedules SET notified = 1 WHERE id = ?').run(drill.id);
          console.log(`✅ Reminder sent to ${drill.user_phone} for drill "${drill.title}"`);
        } catch (smsErr) {
          console.error(`❌ SMS failed for drill ${drill.id}:`, smsErr.message);
        }
      }
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, 60 * 1000); // every 60 seconds
});
