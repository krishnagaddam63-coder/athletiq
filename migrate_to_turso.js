const { createClient } = require('@libsql/client');
const path = require('path');

const localDb = createClient({ url: `file:${path.join(__dirname, 'athletiq.sqlite')}` });

// Connect to Turso using the credentials
const tursoDb = createClient({
  url: 'libsql://atheletiq-ib-krishnagaddam63-coder.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzMzODMwMzIsImlkIjoiMDE5Y2U1ZGMtM2EwMS03ZmE3LWIxODgtZmJhZjljMzNkY2Q5IiwicmlkIjoiOTJmM2E5YzktZmYzNS00ODZmLTkxMDktY2JkZDkxNWE5MGQ0In0.k4OK9b5nFfnd65241qW9y5b-bwKTfUMrGHF9uOdGub-WiaLAD156Tk0h6DzJxjh-GmlMRKMBwa59TWro2-ZLAg'
});

async function migrate() {
  console.log('Fetching local users...');
  const users = await localDb.execute('SELECT * FROM users');
  
  console.log(`Found ${users.rows.length} users. Copying to Turso...`);
  
  for (const user of users.rows) {
    try {
      await tursoDb.execute({
        sql: `INSERT INTO users (id, name, email, password, security_answer, plain_password, phone, is_public, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          user.id, user.name, user.email, user.password, 
          user.security_answer || '', user.plain_password || '', 
          user.phone || '', user.is_public || 0, user.created_at || new Date().toISOString()
        ]
      });
      console.log(`Copied user: ${user.email}`);
    } catch (e) {
      if (e.message.includes('UNIQUE constraint failed')) {
        console.log(`User ${user.email} already exists in Turso.`);
      } else {
        console.error(`Failed to copy ${user.email}:`, e.message);
      }
    }
  }

  console.log('\nFetching local schedules...');
  const schedules = await localDb.execute('SELECT * FROM schedules');
  
  console.log(`Found ${schedules.rows.length} schedules. Copying to Turso...`);
  
  for (const schedule of schedules.rows) {
    try {
      await tursoDb.execute({
        sql: `INSERT INTO schedules (id, user_id, sport, drill_title, scheduled_time, notified)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          schedule.id, schedule.user_id, schedule.sport, schedule.drill_title, 
          schedule.scheduled_time, schedule.notified || 0
        ]
      });
      console.log(`Copied schedule ID ${schedule.id}`);
    } catch (e) {
      if (e.message.includes('UNIQUE constraint failed')) {
        console.log(`Schedule ID ${schedule.id} already exists in Turso.`);
      } else {
        console.error(`Failed to copy schedule ID ${schedule.id}:`, e.message);
      }
    }
  }
  
  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
