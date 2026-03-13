const { createClient } = require('@libsql/client');
const path = require('path');

const localDb = createClient({ url: `file:${path.join(__dirname, 'athletiq.sqlite')}` });

const tursoDb = createClient({
  url: 'libsql://atheletiq-ib-krishnagaddam63-coder.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzMzODMwMzIsImlkIjoiMDE5Y2U1ZGMtM2EwMS03ZmE3LWIxODgtZmJhZjljMzNkY2Q5IiwicmlkIjoiOTJmM2E5YzktZmYzNS00ODZmLTkxMDktY2JkZDkxNWE5MGQ0In0.k4OK9b5nFfnd65241qW9y5b-bwKTfUMrGHF9uOdGub-WiaLAD156Tk0h6DzJxjh-GmlMRKMBwa59TWro2-ZLAg'
});

async function migrate() {
  const users = await localDb.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: ['abhishekkurimeti97@gmail.com']
  });
  if (users.rows.length === 0) return console.log('User not found in local db.');
  
  const user = users.rows[0];
  const oldUserId = user.id;

  try {
    const res = await tursoDb.execute({
      sql: `INSERT INTO users (name, email, password, security_answer, plain_password, phone, is_public, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        user.name, user.email, user.password, 
        user.security_answer || '', user.plain_password || '', 
        user.phone || '', user.is_public || 0, user.created_at || new Date().toISOString()
      ]
    });
    
    const newUserId = res.rows[0].id;
    console.log(`Migrated user. New ID is ${newUserId}`);

    const schedules = await localDb.execute({
      sql: 'SELECT * FROM schedules WHERE user_id = ?',
      args: [oldUserId]
    });

    for (const schedule of schedules.rows) {
      await tursoDb.execute({
        sql: `INSERT INTO schedules (user_id, sport, drill_title, scheduled_time, notified)
              VALUES (?, ?, ?, ?, ?)`,
        args: [
          newUserId, schedule.sport, schedule.drill_title, 
          schedule.scheduled_time, schedule.notified || 0
        ]
      });
      console.log(`Copied a schedule for ${user.email}`);
    }
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log('User already completely migrated.');
    } else {
      console.error('Migration error:', err.message);
    }
  }
}

migrate();
