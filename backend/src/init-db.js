import { config } from './config.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export async function initializeDatabase() {
  if (!config.useSqlite) {
    console.log('⚠️  Using PostgreSQL - run schema.sql manually');
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dbPath = join(__dirname, '..', 'capeconnect.db');

  const SQL = await initSqlJs();
  let db;

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('✅ SQLite database loaded');
    
    // Check if already initialized
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (tables.length > 0) {
      console.log('✅ Database already initialized');
      return;
    }
  } else {
    db = new SQL.Database();
  }

  // Create schema
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      operator TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      replaced_by_hash TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      route_number TEXT NOT NULL,
      route_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      route_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      price REAL NOT NULL,
      purchased_at DATETIME DEFAULT (datetime('now')),
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    );

    CREATE TABLE IF NOT EXISTS stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      stop_name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      stop_id INTEGER NOT NULL,
      arrival_time TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (stop_id) REFERENCES stops(id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT NOT NULL,
      route_id INTEGER,
      fare_type TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      operator TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token_hash ON refresh_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator);
  `);

  // Seed data
  const hashedPassword = bcrypt.hashSync('Demo#123', 10);

  // Generate UUIDs for users
  const userId1 = crypto.randomBytes(16).toString('hex');
  const userId2 = crypto.randomBytes(16).toString('hex');
  const userId3 = crypto.randomBytes(16).toString('hex');
  const userId4 = crypto.randomBytes(16).toString('hex');

  db.run(`INSERT INTO users (id, email, password_hash, full_name, role, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId1, 'myciti-admin@capeconnect.demo', hashedPassword, 'MyCiTi Admin', 'ADMIN', 'ACTIVE', 'MYCITI']);
  db.run(`INSERT INTO users (id, email, password_hash, full_name, role, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId2, 'ga-admin@capeconnect.demo', hashedPassword, 'Golden Arrow Admin', 'ADMIN', 'ACTIVE', 'GOLDEN_ARROW']);
  db.run(`INSERT INTO users (id, email, password_hash, full_name, role, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId3, 'william@capeconnect.demo', hashedPassword, 'William Smith', 'USER', 'ACTIVE', 'MYCITI']);
  db.run(`INSERT INTO users (id, email, password_hash, full_name, role, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId4, 'sihle@capeconnect.demo', hashedPassword, 'Sihle Ndlovu', 'USER', 'ACTIVE', 'GOLDEN_ARROW']);

  // Insert wallets
  db.run(`INSERT INTO wallets (user_id, balance, operator) VALUES (?, ?, ?)`, [userId3, 100.00, 'MYCITI']);
  db.run(`INSERT INTO wallets (user_id, balance, operator) VALUES (?, ?, ?)`, [userId4, 150.00, 'GOLDEN_ARROW']);

  // Insert sample routes
  db.run(`INSERT INTO routes (operator, route_number, route_name, origin, destination) VALUES (?, ?, ?, ?, ?)`,
    ['MYCITI', 'T01', 'Table Bay', 'Civic Centre', 'Table View']);
  db.run(`INSERT INTO routes (operator, route_number, route_name, origin, destination) VALUES (?, ?, ?, ?, ?)`,
    ['GOLDEN_ARROW', '101', 'City Express', 'Cape Town Station', 'Bellville']);

  // Insert sample stops
  db.run(`INSERT INTO stops (operator, stop_name, latitude, longitude) VALUES (?, ?, ?, ?)`,
    ['MYCITI', 'Civic Centre', -33.9249, 18.4241]);
  db.run(`INSERT INTO stops (operator, stop_name, latitude, longitude) VALUES (?, ?, ?, ?)`,
    ['MYCITI', 'Table View', -33.8116, 18.5017]);
  db.run(`INSERT INTO stops (operator, stop_name, latitude, longitude) VALUES (?, ?, ?, ?)`,
    ['GOLDEN_ARROW', 'Cape Town Station', -33.9249, 18.4241]);
  db.run(`INSERT INTO stops (operator, stop_name, latitude, longitude) VALUES (?, ?, ?, ?)`,
    ['GOLDEN_ARROW', 'Bellville', -33.8997, 18.6297]);

  // Insert sample prices
  db.run(`INSERT INTO prices (operator, route_id, fare_type, amount) VALUES (?, ?, ?, ?)`,
    ['MYCITI', 1, 'SINGLE', 15.00]);
  db.run(`INSERT INTO prices (operator, route_id, fare_type, amount) VALUES (?, ?, ?, ?)`,
    ['GOLDEN_ARROW', 2, 'SINGLE', 12.00]);

  // Save database
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);

  console.log('✅ Database seeded with demo data');
  console.log('✅ SQLite database initialized');
}
