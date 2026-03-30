import pg from "pg";
import { config } from "./config.js";
import { log, serializeError } from "./utils/logger.js";
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase } from './init-db.js';

const { Pool } = pg;

let pool, db, usingSqlite;

if (config.useSqlite || config.env === 'test') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dbPath = join(__dirname, '..', 'capeconnect.db');
  
  const SQL = await initSqlJs();
  
  // Initialize database with proper schema first
  await initializeDatabase();
  
  // Now load the properly initialized database
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Save database periodically (skip in test mode)
  if (config.env !== 'test') {
    setInterval(() => {
      const data = db.export();
      const buffer = Buffer.from(data);
      writeFileSync(dbPath, buffer);
    }, 5000);
  }
  
  // Save on exit
  process.on('exit', () => {
    if (config.env !== 'test') {
      const data = db.export();
      const buffer = Buffer.from(data);
      writeFileSync(dbPath, buffer);
    }
  });
  
  usingSqlite = true;
  log('info', 'Using SQLite database (sql.js) with proper schema');
} else {
  pool = new Pool({
    connectionString: config.databaseUrl
  });
  usingSqlite = false;
  log('info', 'Using PostgreSQL database');
}

export { pool };

let testDoubles = null;

export async function query(text, params = []) {
  if (testDoubles?.query) {
    return testDoubles.query(text, params);
  }

  if (usingSqlite) {
    try {
      // Replace PostgreSQL syntax with SQLite equivalents
      let sqliteQuery = text
        .replace(/gen_random_uuid\(\)/g, "lower(hex(randomblob(16)))")
        .replace(/UUID/g, "TEXT")
        .replace(/TIMESTAMPTZ/g, "DATETIME")
        .replace(/BIGINT/g, "INTEGER")
        .replace(/BOOLEAN/g, "INTEGER")
        .replace(/JSONB/g, "TEXT")
        .replace(/'(\[\]|\{\})'::jsonb/g, "'$1'")
        .replace(/NOW\(\)/g, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/g, "datetime('now')")
        .replace(/ON DELETE CASCADE/g, "")
        .replace(/ON DELETE SET NULL/g, "");
      
      // Replace $1, $2 with ? for SQLite
      params.forEach((_, index) => {
        sqliteQuery = sqliteQuery.replace(new RegExp(`\\$${index + 1}(?!\\d)`, "g"), "?");
      });

      const result = db.exec(sqliteQuery, params);
      
      if (result.length === 0) {
        return { rows: [] };
      }
      
      const columns = result[0].columns;
      const rows = result[0].values.map(values => {
        const row = {};
        columns.forEach((col, idx) => {
          row[col] = values[idx];
        });
        return row;
      });
      
      return { rows };
    } catch (error) {
      log('error', 'SQLite query error', { error: serializeError(error), query: text, params });
      throw error;
    }
  }

  const result = await pool.query(text, params);
  return result;
}

export async function withTransaction(work) {
  if (testDoubles?.withTransaction) {
    return testDoubles.withTransaction(work);
  }

  if (usingSqlite) {
    db.run('BEGIN TRANSACTION');
    try {
      const result = await work({ query });
      db.run('COMMIT');
      return result;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback errors and rethrow original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function __setDbTestDoubles(doubles) {
  testDoubles = doubles || null;
}

export function __clearDbTestDoubles() {
  testDoubles = null;
}
