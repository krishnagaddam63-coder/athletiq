const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = new Database(DB_PATH);

try {
  db.exec('ALTER TABLE users ADD COLUMN is_public INTEGER DEFAULT 0');
  console.log("Added 'is_public' column to users table.");
} catch (err) {
  if (err.message.includes('duplicate column')) {
    console.log("'is_public' column already exists.");
  } else {
    console.error(err);
  }
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);
  console.log("Messages table ready.");
} catch (err) {
  console.error(err);
}

db.close();
