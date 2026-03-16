import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'capeconnect.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Wrapper to make SQLite work like pg
export const query = (text, params = []) => {
  try {
    // Handle SELECT queries
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      const stmt = db.prepare(text);
      const rows = stmt.all(...params);
      return { rows };
    }
    
    // Handle INSERT with RETURNING
    if (text.includes('RETURNING')) {
      const cleanText = text.replace(/RETURNING \*/g, '');
      const stmt = db.prepare(cleanText);
      const info = stmt.run(...params);
      
      // Get the inserted row
      const lastId = info.lastInsertRowid;
      const tableName = text.match(/INSERT INTO (\w+)/i)[1];
      const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(lastId);
      return { rows: [row] };
    }
    
    // Handle UPDATE/DELETE with RETURNING
    if (text.includes('UPDATE') && text.includes('RETURNING')) {
      const parts = text.split('RETURNING');
      const updateText = parts[0].trim();
      
      // Execute update
      const stmt = db.prepare(updateText);
      stmt.run(...params);
      
      // Get updated row
      const tableName = text.match(/UPDATE (\w+)/i)[1];
      const whereMatch = text.match(/WHERE (.+?) RETURNING/i);
      if (whereMatch) {
        const selectText = `SELECT * FROM ${tableName} WHERE ${whereMatch[1]}`;
        const row = db.prepare(selectText).get(...params.slice(-1));
        return { rows: [row] };
      }
      return { rows: [] };
    }
    
    // Handle regular INSERT/UPDATE/DELETE
    const stmt = db.prepare(text);
    const info = stmt.run(...params);
    return { rows: [], rowCount: info.changes };
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
};

// Initialize database schema
export const initializeDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      route_number TEXT NOT NULL,
      route_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      price REAL NOT NULL,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      stop_name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      stop_id INTEGER NOT NULL,
      arrival_time TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
      FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      route_id INTEGER,
      fare_type TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      operator TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator);
  `);

  console.log('✅ SQLite database initialized');
};

// Seed initial data
export const seedDatabase = () => {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = bcrypt.hashSync('Demo#123', 10);

  // Check if data already exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('✅ Database already seeded');
    return;
  }

  // Insert users
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, operator)
    VALUES (?, ?, ?, ?)
  `);

  const users = [
    ['myciti-admin@capeconnect.demo', hashedPassword, 'ADMIN', 'MYCITI'],
    ['ga-admin@capeconnect.demo', hashedPassword, 'ADMIN', 'GOLDEN_ARROW'],
    ['william@capeconnect.demo', hashedPassword, 'USER', 'MYCITI'],
    ['sihle@capeconnect.demo', hashedPassword, 'USER', 'GOLDEN_ARROW'],
  ];

  const insertMany = db.transaction((users) => {
    for (const user of users) {
      insertUser.run(...user);
    }
  });

  insertMany(users);

  // Insert wallets for users
  const insertWallet = db.prepare(`
    INSERT INTO wallets (user_id, balance, operator)
    VALUES (?, ?, ?)
  `);

  insertWallet.run(3, 100.00, 'MYCITI');
  insertWallet.run(4, 150.00, 'GOLDEN_ARROW');

  // Insert sample routes
  const insertRoute = db.prepare(`
    INSERT INTO routes (operator, route_number, route_name, origin, destination)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRoute.run('MYCITI', 'T01', 'Table Bay', 'Civic Centre', 'Table View');
  insertRoute.run('GOLDEN_ARROW', '101', 'City Express', 'Cape Town Station', 'Bellville');

  console.log('✅ Database seeded with demo data');
};

export default db;
