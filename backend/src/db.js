import pg from "pg";
import { config } from "./config.js";
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

let pool, db, usingSqlite;

if (config.useSqlite) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dbPath = join(__dirname, '..', 'capeconnect.db');
  
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Save database periodically
  setInterval(() => {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }, 5000);
  
  // Save on exit
  process.on('exit', () => {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  });
  
  usingSqlite = true;
  console.log('📦 Using SQLite database (sql.js)');
} else {
  pool = new Pool({
    connectionString: config.databaseUrl
  });
  usingSqlite = false;
  console.log('🐘 Using PostgreSQL database');
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
        .replace(/NOW\(\)/g, "datetime('now')")
        .replace(/CURRENT_TIMESTAMP/g, "datetime('now')")
        .replace(/ON DELETE CASCADE/g, "")
        .replace(/ON DELETE SET NULL/g, "");
      
      // Replace $1, $2 with ? for SQLite
      params.forEach((_, index) => {
        sqliteQuery = sqliteQuery.replace(`$${index + 1}`, '?');
      });
      
      // Handle RETURNING clause
      if (sqliteQuery.includes('RETURNING')) {
        const cleanQuery = sqliteQuery.replace(/RETURNING \*/g, '');
        db.run(cleanQuery, params);
        
        // Get last inserted row
        const tableName = sqliteQuery.match(/INSERT INTO (\w+)/i)?.[1];
        if (tableName) {
          const result = db.exec(`SELECT * FROM ${tableName} WHERE id = last_insert_rowid()`);
          if (result.length > 0) {
            const columns = result[0].columns;
            const values = result[0].values[0];
            const row = {};
            columns.forEach((col, idx) => {
              row[col] = values[idx];
            });
            return { rows: [row] };
          }
        }
        return { rows: [] };
      }
      
      // Regular query
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
      console.error('SQLite query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
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
