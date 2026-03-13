const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');

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

// ─── PostgreSQL Database ──────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ─── Initialize Tables ────────────────────────────────────────────────────
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id               SERIAL PRIMARY KEY,
        name             TEXT NOT NULL,
        email            TEXT NOT NULL UNIQUE,
        password         TEXT NOT NULL,
        security_answer  TEXT NOT NULL DEFAULT '',
        plain_password   TEXT NOT NULL DEFAULT '',
        phone            TEXT NOT NULL DEFAULT '',
        is_public        INTEGER DEFAULT 0,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id),
        sport          TEXT NOT NULL,
        drill_title    TEXT NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        notified       INTEGER DEFAULT 0
      )
    `);

    console.log('✅ Database tables ready.');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  } finally {
    client.release();
  }
}

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
    const hashedPass   = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(security_answer.trim().toLowerCase(), 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, security_answer, plain_password, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, email.toLowerCase(), hashedPass, hashedAnswer, '', phone.trim()]
    );

    res.status(201).json({
      message: 'Account created successfully!',
      userId: result.rows[0].id
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/forgot-password  — Verify security answer
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, security_answer } = req.body;
  if (!email || !security_answer) {
    return res.status(400).json({ error: 'Email and security answer are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'No account found with that email.' });
    }

    const match = await bcrypt.compare(security_answer.trim().toLowerCase(), user.security_answer);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect answer. Please try again.' });
    }

    res.json({ message: 'Identity verified.', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
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
    const result = await pool.query(
      "UPDATE users SET password = $1, plain_password = '' WHERE id = $2",
      [hashedPass, userId]
    );

    if (result.rowCount === 0) {
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

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
app.get('/api/db/schema', async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) AS total FROM users');
    const usersResult = await pool.query('SELECT id, name, email, phone, created_at FROM users ORDER BY id');
    const users = usersResult.rows.map(u => ({
      ...u,
      password: '[ENCRYPTED]',
      security_answer: '[ENCRYPTED]',
      plain_password: '[REMOVED]'
    }));
    res.json({
      table: 'users',
      total_users: parseInt(countResult.rows[0].total),
      users
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/db/users  — Return all registered users (fully masked)
app.get('/api/db/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, created_at FROM users ORDER BY id');
    const users = result.rows.map(u => ({
      ...u,
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

// POST /api/schedules - Schedule a drill
app.post('/api/schedules', async (req, res) => {
  const { user_id, sport, title, scheduled_time } = req.body;

  if (!user_id || !sport || !title || !scheduled_time) {
    return res.status(400).json({ error: 'All fields are required to schedule a drill.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO schedules (user_id, sport, drill_title, scheduled_time, notified) VALUES ($1, $2, $3, $4, 0) RETURNING id',
      [user_id, sport, title, scheduled_time]
    );
    res.json({ message: 'Drill scheduled successfully!', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule drill' });
  }
});

// GET /api/schedules/:userId - Get schedules for a user
app.get('/api/schedules/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, sport, drill_title AS title, scheduled_time, notified FROM schedules WHERE user_id = $1 ORDER BY scheduled_time ASC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

// GET /api/reports/:userId - Get weekly report summary
app.get('/api/reports/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM schedules WHERE user_id = $1 AND scheduled_time >= NOW() - INTERVAL '7 days'",
      [req.params.userId]
    );
    const schedules = result.rows;
    const totalSchedules = schedules.length;

    let sportsCount = {};
    schedules.forEach(s => {
      sportsCount[s.sport] = (sportsCount[s.sport] || 0) + 1;
    });

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

// POST /api/send-sms  — Trigger an SMS notification
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
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 AthletiQ server running at http://localhost:${PORT}`);
    console.log(`📋 DB Schema:      http://localhost:${PORT}/api/db/schema`);
    console.log(`🔐 Register:       POST http://localhost:${PORT}/api/auth/register`);
    console.log(`🔑 Login:          POST http://localhost:${PORT}/api/auth/login`);
    console.log(`🌐 Website:        http://localhost:${PORT}/index.html`);
    console.log(`📱 SMS Reminder Scheduler: running (checks every 60s)\n`);

    // ─── Server-side Drill Reminder Scheduler ──────────────────────────────
    setInterval(async () => {
      try {
        const upcoming = await pool.query(`
          SELECT s.id, s.drill_title AS title, s.sport, s.scheduled_time,
                 u.name AS user_name, u.phone AS user_phone
          FROM   schedules s
          JOIN   users u ON u.id = s.user_id
          WHERE  s.notified = 0
            AND  s.scheduled_time >= NOW() + INTERVAL '29 minutes'
            AND  s.scheduled_time <= NOW() + INTERVAL '31 minutes'
        `);

        for (const drill of upcoming.rows) {
          if (!drill.user_phone) {
            console.log(`⚠️  No phone for user "${drill.user_name}" — skipping SMS`);
            continue;
          }

          const schedTime = new Date(drill.scheduled_time);
          const timeStr = schedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          const dateStr = schedTime.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const smsMessage = `AthletiQ Reminder 🏆: Hi ${drill.user_name}! Your ${drill.sport} drill "${drill.title}" starts in 30 minutes at ${timeStr} on ${dateStr}. Get ready! 💪`;

          try {
            await sendSmsViaProvider(drill.user_phone, smsMessage);
            await pool.query('UPDATE schedules SET notified = 1 WHERE id = $1', [drill.id]);
            console.log(`✅ Reminder sent to ${drill.user_phone} for drill "${drill.title}"`);
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
  console.error('❌ Failed to connect to database:', err.message);
  process.exit(1);
});
