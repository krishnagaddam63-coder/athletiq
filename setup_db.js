const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'athletiq.sqlite');
const db = new Database(DB_PATH);

// Enable WAL for performance
db.pragma('journal_mode = WAL');

// Create the users table (ONLY user login details as requested)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('✅ Database setup complete!');
console.log('📁 Database file: athletiq.sqlite');
console.log('');
console.log('📋 Schema:');
console.log('  Table: users');
console.log('    - id          INTEGER PRIMARY KEY AUTOINCREMENT');
console.log('    - name        TEXT NOT NULL');
console.log('    - email       TEXT NOT NULL UNIQUE');
console.log('    - password    TEXT NOT NULL (bcrypt hashed)');
console.log('    - created_at  DATETIME DEFAULT CURRENT_TIMESTAMP');

db.close();
