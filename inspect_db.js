const { createClient } = require('@libsql/client');
const path = require('path');

const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = createClient({ url: `file:${DB_PATH}` });

async function run() {
  const users = await db.execute('SELECT id, name, email, password, plain_password, security_answer, phone FROM users');
  console.log(JSON.stringify(users.rows, null, 2));
}

run();
