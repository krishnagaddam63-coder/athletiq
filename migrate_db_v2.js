const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = new Database(DB_PATH);

try {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ""');
  console.log("Added 'phone' column to users table.");
} catch (err) {
  if (err.message.includes('duplicate column')) {
    console.log("'phone' column already exists.");
  } else {
    console.error(err);
  }
}

try {
  // Create schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      sport TEXT,
      drill_title TEXT,
      scheduled_time DATETIME,
      notified INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log("Schedules table ready.");
} catch (err) {
  console.error(err);
}

db.close();
