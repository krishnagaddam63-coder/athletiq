const { createClient } = require('@libsql/client');

const tursoDb = createClient({
  url: 'libsql://atheletiq-ib-krishnagaddam63-coder.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzMzODMwMzIsImlkIjoiMDE5Y2U1ZGMtM2EwMS03ZmE3LWIxODgtZmJhZjljMzNkY2Q5IiwicmlkIjoiOTJmM2E5YzktZmYzNS00ODZmLTkxMDktY2JkZDkxNWE5MGQ0In0.k4OK9b5nFfnd65241qW9y5b-bwKTfUMrGHF9uOdGub-WiaLAD156Tk0h6DzJxjh-GmlMRKMBwa59TWro2-ZLAg'
});

async function viewDb() {
  const users = await tursoDb.execute('SELECT id, name, email FROM users ORDER BY id');
  let md = '### 👤 Users in Turso Database\\n\\n| ID | Name | Email |\\n|---|---|---|\\n';
  users.rows.forEach(u => {
    md += `| ${u.id} | ${u.name} | ${u.email} |\\n`;
  });
  
  const schedules = await tursoDb.execute('SELECT id, user_id, sport, drill_title, scheduled_time FROM schedules ORDER BY id');
  md += '\\n### 🗓️ Schedules in Turso Database\\n\\n| ID | User ID | Sport | Drill | Time |\\n|---|---|---|---|---|\\n';
  schedules.rows.forEach(s => {
    md += `| ${s.id} | ${s.user_id} | ${s.sport} | ${s.drill_title} | ${new Date(s.scheduled_time).toLocaleString()} |\\n`;
  });
  console.log(md);
}

viewDb();
