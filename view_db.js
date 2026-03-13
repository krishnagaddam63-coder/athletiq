const { createClient } = require('@libsql/client');

const tursoDb = createClient({
  url: 'libsql://atheletiq-ib-krishnagaddam63-coder.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzMzODMwMzIsImlkIjoiMDE5Y2U1ZGMtM2EwMS03ZmE3LWIxODgtZmJhZjljMzNkY2Q5IiwicmlkIjoiOTJmM2E5YzktZmYzNS00ODZmLTkxMDktY2JkZDkxNWE5MGQ0In0.k4OK9b5nFfnd65241qW9y5b-bwKTfUMrGHF9uOdGub-WiaLAD156Tk0h6DzJxjh-GmlMRKMBwa59TWro2-ZLAg'
});

async function viewDb() {
  console.log('--- USERS IN TURSO DATABASE ---');
  const users = await tursoDb.execute('SELECT id, name, email, phone FROM users ORDER BY id');
  console.table(users.rows);
  
  console.log('\n--- SCHEDULES IN TURSO DATABASE ---');
  const schedules = await tursoDb.execute('SELECT id, user_id, sport, drill_title, scheduled_time FROM schedules ORDER BY id');
  console.table(schedules.rows);
}

viewDb();
