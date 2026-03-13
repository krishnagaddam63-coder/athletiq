const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = new Database(DB_PATH);

async function migrate() {
  console.log('🚀 Starting security migration...');
  
  const users = db.prepare('SELECT id, security_answer, plain_password FROM users').all();
  
  const updateStmt = db.prepare('UPDATE users SET security_answer = ?, plain_password = ? WHERE id = ?');
  
  let migratedCount = 0;
  
  for (const user of users) {
    // Check if security_answer is already likely a bcrypt hash (starts with $2a$ or $2b$)
    const isAlreadyHashed = user.security_answer.startsWith('$2a$') || user.security_answer.startsWith('$2b$');
    
    if (!isAlreadyHashed) {
      console.log(`🔒 Hashing idol/answer for User ID: ${user.id}...`);
      const hashedAnswer = await bcrypt.hash(user.security_answer.trim().toLowerCase(), 10);
      updateStmt.run(hashedAnswer, '', user.id); // clear plain_password at the same time
      migratedCount++;
    } else {
      console.log(`✅ User ID: ${user.id} already has a hashed answer. Clearing plain_password if exists.`);
      updateStmt.run(user.security_answer, '', user.id);
    }
  }
  
  console.log(`\n🎉 Migration complete! ${migratedCount} users secured.`);
  db.close();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
