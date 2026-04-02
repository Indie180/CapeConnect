import { config } from "./config.js";
import { log } from "./utils/logger.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import initSqlJs from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

function firstValue(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  return result[0].values[0][0];
}

function tableExists(db, tableName) {
  return Boolean(
    firstValue(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      [tableName]
    )
  );
}

function getColumns(db, tableName) {
  if (!tableExists(db, tableName)) return [];
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result.length) return [];
  const [shape] = result;
  return shape.values.map((row) => {
    const out = {};
    shape.columns.forEach((column, index) => {
      out[column] = row[index];
    });
    return out;
  });
}

function getColumn(db, tableName, columnName) {
  return getColumns(db, tableName).find(
    (column) => String(column.name || "").toLowerCase() === String(columnName || "").toLowerCase()
  ) || null;
}

function hasColumn(db, tableName, columnName) {
  return getColumns(db, tableName).some(
    (column) => String(column.name || "").toLowerCase() === String(columnName || "").toLowerCase()
  );
}

function ensureColumn(db, tableName, columnName, definition) {
  if (!tableExists(db, tableName) || hasColumn(db, tableName, columnName)) return;
  const sqliteSafeDefinition = String(definition || "")
    .replace(/\s+DEFAULT\s+\(datetime\('now'\)\)/i, "")
    .replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/i, "")
    .replace(/\s+NOT\s+NULL/gi, "")
    .trim();
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqliteSafeDefinition}`);
}

function countRows(db, tableName) {
  return Number(firstValue(db, `SELECT COUNT(*) FROM ${tableName}`) || 0);
}

function renameLegacyTable(db, tableName, legacyName) {
  if (!tableExists(db, tableName) || tableExists(db, legacyName)) return;
  db.run(`ALTER TABLE ${tableName} RENAME TO ${legacyName}`);
}

function prepareLegacyTables(db) {
  const stopId = getColumn(db, "stops", "id");
  if (stopId && !String(stopId.type || "").toUpperCase().includes("TEXT")) {
    renameLegacyTable(db, "stops", "stops_legacy");
  }

  const routeId = getColumn(db, "routes", "id");
  if (routeId && !String(routeId.type || "").toUpperCase().includes("TEXT")) {
    renameLegacyTable(db, "routes", "routes_legacy");
  }

  const ticketId = getColumn(db, "tickets", "id");
  if (ticketId && !String(ticketId.type || "").toUpperCase().includes("TEXT")) {
    renameLegacyTable(db, "tickets", "tickets_legacy");
  }
}

function normalizeOperator(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "myciti") return "MyCiTi";
  if (raw === "ga" || raw === "golden arrow" || raw === "golden_arrow" || raw === "golden-arrow" || raw === "goldenarrow") {
    return "Golden Arrow";
  }
  return String(value || "").trim();
}

function seedUsers(db) {
  if (countRows(db, "users") > 0) return;

  const hashedPassword = bcrypt.hashSync("Demo#123", 10);
  const users = [
    [randomId(), "myciti-admin@capeconnect.demo", hashedPassword, "MyCiTi Admin", null, "operator_admin", "ACTIVE", "MyCiTi"],
    [randomId(), "ga-admin@capeconnect.demo", hashedPassword, "Golden Arrow Admin", null, "operator_admin", "ACTIVE", "Golden Arrow"],
    [randomId(), "william@capeconnect.demo", hashedPassword, "William Smith", "0821110001", "passenger", "ACTIVE", "MyCiTi"],
    [randomId(), "sihle@capeconnect.demo", hashedPassword, "Sihle Ndlovu", "0821110002", "passenger", "ACTIVE", "Golden Arrow"],
  ];

  users.forEach((user) => {
    db.run(
      `
      INSERT INTO users (id, email, password_hash, full_name, phone, role, status, operator, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      user
    );
  });
}

function ensureModernTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'passenger',
      operator TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      blacklist_reason TEXT,
      blacklist_until DATETIME,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      last_activity DATETIME DEFAULT (datetime('now')),
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      replaced_by_hash TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_services (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_key TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, service_key)
    );

    CREATE TABLE IF NOT EXISTS user_banking_profiles (
      user_id TEXT PRIMARY KEY,
      bank_name TEXT,
      branch_name TEXT,
      branch_code TEXT,
      country TEXT,
      account_number TEXT,
      account_type TEXT,
      currency TEXT,
      account_holder_confirmed INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ZAR',
      operator TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      description TEXT,
      payment_id TEXT,
      balance_before_cents INTEGER,
      balance_after_cents INTEGER,
      ref_ticket_id TEXT,
      note TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      name TEXT,
      code TEXT,
      lat REAL,
      lon REAL,
      stop_name TEXT,
      latitude REAL,
      longitude REAL,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      route_code TEXT,
      route_number TEXT,
      route_name TEXT NOT NULL,
      origin TEXT,
      destination TEXT,
      from_stop_id TEXT,
      to_stop_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'Outbound',
      day_type TEXT NOT NULL DEFAULT 'Weekday',
      stops_json TEXT NOT NULL DEFAULT '[]',
      times_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'PUBLISHED',
      effective_from TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fare_products (
      id TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      product_key TEXT NOT NULL,
      label TEXT NOT NULL,
      journeys INTEGER,
      price_cents INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
      UNIQUE (operator, product_key)
    );

    CREATE TABLE IF NOT EXISTS route_prices (
      id TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      from_stop_id TEXT,
      to_stop_id TEXT,
      five_ride_cents INTEGER,
      weekly_cents INTEGER,
      monthly_cents INTEGER,
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      route_id TEXT,
      operator TEXT,
      product_type TEXT,
      product_name TEXT,
      journeys_included INTEGER,
      journeys_used INTEGER NOT NULL DEFAULT 0,
      route_from TEXT,
      route_to TEXT,
      amount_cents INTEGER,
      currency TEXT NOT NULL DEFAULT 'ZAR',
      status TEXT NOT NULL DEFAULT 'PAID',
      price REAL,
      purchased_at DATETIME NOT NULL DEFAULT (datetime('now')),
      used_at DATETIME,
      valid_from DATETIME,
      valid_until DATETIME,
      payment_method TEXT,
      card_alias TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      at DATETIME NOT NULL DEFAULT (datetime('now')),
      operator TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      before_json TEXT,
      after_json TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ZAR',
      status TEXT NOT NULL DEFAULT 'PENDING',
      payment_method TEXT NOT NULL DEFAULT 'payfast',
      description TEXT,
      reference TEXT,
      payfast_payment_id TEXT,
      payfast_pf_payment_id TEXT,
      merchant_payment_id TEXT,
      pf_payment_id TEXT,
      signature TEXT,
      completed_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_webhooks (
      id TEXT PRIMARY KEY,
      payment_id TEXT,
      webhook_data TEXT NOT NULL,
      signature_valid INTEGER NOT NULL DEFAULT 0,
      processed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at DATETIME NOT NULL DEFAULT (datetime('now'))
    );

  `);
}

function ensureIndexes(db) {
  db.run(`
    DELETE FROM stops
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM stops
      GROUP BY lower(operator), lower(name)
    )
  `);
  db.run(`
    DELETE FROM routes
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM routes
      GROUP BY lower(operator), lower(route_code)
    )
  `);
  db.run(`
    DELETE FROM wallets
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM wallets
      GROUP BY user_id
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_unique ON wallets(user_id)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_operator_name_unique ON stops(operator, name)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_operator_code_unique ON routes(operator, route_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token_hash ON refresh_sessions(token_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_services_user_id ON user_services(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_user_banking_profiles_updated ON user_banking_profiles(updated_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_user_purchased ON tickets(user_id, purchased_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_operator ON tickets(operator)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC)`);
}

function migrateUsers(db) {
  ensureColumn(db, "users", "phone", "TEXT");
  ensureColumn(db, "users", "operator", "TEXT");
  ensureColumn(db, "users", "updated_at", "DATETIME DEFAULT (datetime('now'))");
  ensureColumn(db, "users", "blacklist_reason", "TEXT");
  ensureColumn(db, "users", "blacklist_until", "DATETIME");
  ensureColumn(db, "users", "failed_attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "locked_until", "DATETIME");

  if (tableExists(db, "users")) {
    db.run(`
      UPDATE users
      SET role = CASE
        WHEN lower(coalesce(role, '')) = 'admin' THEN 'operator_admin'
        WHEN lower(coalesce(role, '')) = 'user' THEN 'passenger'
        ELSE coalesce(role, 'passenger')
      END
    `);
    db.run(`
      UPDATE users
      SET operator = CASE
        WHEN lower(coalesce(operator, '')) = 'myciti' THEN 'MyCiTi'
        WHEN lower(coalesce(operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
        ELSE operator
      END
    `);
    db.run(`UPDATE users SET updated_at = coalesce(updated_at, created_at, datetime('now'))`);
  }
}

function migrateSupportTables(db) {
  ensureColumn(db, "user_services", "created_at", "DATETIME");
  ensureColumn(db, "wallet_transactions", "created_at", "DATETIME");
}

function migrateWallets(db) {
  ensureColumn(db, "wallets", "balance_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "wallets", "currency", "TEXT NOT NULL DEFAULT 'ZAR'");
  ensureColumn(db, "wallets", "updated_at", "DATETIME NOT NULL DEFAULT (datetime('now'))");

  db.run(`
    DELETE FROM wallets
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM wallets
      GROUP BY user_id
    )
  `);

  db.run(`
    UPDATE wallets
    SET balance_cents = CASE
      WHEN coalesce(balance_cents, 0) <= 0 THEN CAST(ROUND(coalesce(balance, 0) * 100) AS INTEGER)
      ELSE balance_cents
    END
  `);
  db.run(`UPDATE wallets SET updated_at = coalesce(updated_at, created_at, datetime('now'))`);
}

function migrateStops(db) {
  if (tableExists(db, "stops_legacy") && countRows(db, "stops") === 0) {
    db.run(`
      INSERT INTO stops (id, operator, name, stop_name, lat, lon, latitude, longitude, created_at)
      SELECT
        lower(hex(randomblob(16))),
        CASE
          WHEN lower(coalesce(operator, '')) = 'myciti' THEN 'MyCiTi'
          WHEN lower(coalesce(operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
          ELSE operator
        END,
        stop_name,
        stop_name,
        latitude,
        longitude,
        latitude,
        longitude,
        coalesce(created_at, datetime('now'))
      FROM stops_legacy
    `);
  }

  ensureColumn(db, "stops", "name", "TEXT");
  ensureColumn(db, "stops", "code", "TEXT");
  ensureColumn(db, "stops", "lat", "REAL");
  ensureColumn(db, "stops", "lon", "REAL");
  ensureColumn(db, "stops", "stop_name", "TEXT");
  ensureColumn(db, "stops", "latitude", "REAL");
  ensureColumn(db, "stops", "longitude", "REAL");

  db.run(`UPDATE stops SET name = coalesce(name, stop_name)`);
  db.run(`UPDATE stops SET lat = coalesce(lat, latitude)`);
  db.run(`UPDATE stops SET lon = coalesce(lon, longitude)`);
  db.run(`
    UPDATE stops
    SET operator = CASE
      WHEN lower(coalesce(operator, '')) = 'myciti' THEN 'MyCiTi'
      WHEN lower(coalesce(operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
      ELSE operator
    END
  `);
}

function migrateRoutes(db) {
  if (tableExists(db, "routes_legacy") && countRows(db, "routes") === 0) {
    db.run(`
      INSERT INTO routes (
        id, operator, route_code, route_number, route_name, origin, destination,
        from_stop_id, to_stop_id, active, created_at, updated_at
      )
      SELECT
        lower(hex(randomblob(16))),
        CASE
          WHEN lower(coalesce(operator, '')) = 'myciti' THEN 'MyCiTi'
          WHEN lower(coalesce(operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
          ELSE operator
        END,
        route_number,
        route_number,
        route_name,
        origin,
        destination,
        (
          SELECT s.id
          FROM stops s
          WHERE lower(s.name) = lower(routes_legacy.origin)
            AND lower(s.operator) = lower(
              CASE
                WHEN lower(coalesce(routes_legacy.operator, '')) = 'myciti' THEN 'MyCiTi'
                WHEN lower(coalesce(routes_legacy.operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
                ELSE routes_legacy.operator
              END
            )
          LIMIT 1
        ),
        (
          SELECT s.id
          FROM stops s
          WHERE lower(s.name) = lower(routes_legacy.destination)
            AND lower(s.operator) = lower(
              CASE
                WHEN lower(coalesce(routes_legacy.operator, '')) = 'myciti' THEN 'MyCiTi'
                WHEN lower(coalesce(routes_legacy.operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
                ELSE routes_legacy.operator
              END
            )
          LIMIT 1
        ),
        1,
        coalesce(created_at, datetime('now')),
        datetime('now')
      FROM routes_legacy
    `);
  }

  ensureColumn(db, "routes", "route_code", "TEXT");
  ensureColumn(db, "routes", "route_number", "TEXT");
  ensureColumn(db, "routes", "origin", "TEXT");
  ensureColumn(db, "routes", "destination", "TEXT");
  ensureColumn(db, "routes", "from_stop_id", "TEXT");
  ensureColumn(db, "routes", "to_stop_id", "TEXT");
  ensureColumn(db, "routes", "active", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "routes", "updated_at", "DATETIME NOT NULL DEFAULT (datetime('now'))");

  db.run(`UPDATE routes SET route_code = coalesce(route_code, route_number)`);
  db.run(`UPDATE routes SET route_number = coalesce(route_number, route_code)`);
  db.run(`
    UPDATE routes
    SET operator = CASE
      WHEN lower(coalesce(operator, '')) = 'myciti' THEN 'MyCiTi'
      WHEN lower(coalesce(operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
      ELSE operator
    END
  `);
  db.run(`UPDATE routes SET active = coalesce(active, 1)`);
  db.run(`UPDATE routes SET updated_at = coalesce(updated_at, created_at, datetime('now'))`);
  db.run(`
    UPDATE routes
    SET from_stop_id = (
      SELECT s.id
      FROM stops s
      WHERE lower(s.name) = lower(routes.origin)
        AND lower(s.operator) = lower(routes.operator)
      LIMIT 1
    )
    WHERE (from_stop_id IS NULL OR trim(from_stop_id) = '') AND origin IS NOT NULL
  `);
  db.run(`
    UPDATE routes
    SET to_stop_id = (
      SELECT s.id
      FROM stops s
      WHERE lower(s.name) = lower(routes.destination)
        AND lower(s.operator) = lower(routes.operator)
      LIMIT 1
    )
    WHERE (to_stop_id IS NULL OR trim(to_stop_id) = '') AND destination IS NOT NULL
  `);
}

function migrateTickets(db) {
  if (tableExists(db, "tickets_legacy") && countRows(db, "tickets") === 0) {
    db.run(`
      INSERT INTO tickets (
        id, user_id, route_id, operator, product_type, product_name,
        journeys_included, journeys_used, route_from, route_to,
        amount_cents, currency, status, price, purchased_at, used_at,
        valid_from, valid_until, payment_method, card_alias, meta, updated_at
      )
      SELECT
        lower(hex(randomblob(16))),
        tl.user_id,
        NULL,
        CASE
          WHEN lower(coalesce(rl.operator, '')) = 'myciti' THEN 'MyCiTi'
          WHEN lower(coalesce(rl.operator, '')) IN ('ga', 'golden_arrow', 'golden-arrow', 'golden arrow', 'goldenarrow') THEN 'Golden Arrow'
          ELSE rl.operator
        END,
        'single',
        coalesce(rl.route_name, 'Ticket'),
        NULL,
        0,
        rl.origin,
        rl.destination,
        CAST(ROUND(coalesce(tl.price, 0) * 100) AS INTEGER),
        'ZAR',
        coalesce(tl.status, 'PAID'),
        tl.price,
        coalesce(tl.purchased_at, datetime('now')),
        tl.used_at,
        coalesce(tl.purchased_at, datetime('now')),
        NULL,
        'card',
        NULL,
        '{}',
        datetime('now')
      FROM tickets_legacy tl
      LEFT JOIN routes_legacy rl ON rl.id = tl.route_id
    `);
  }

  ensureColumn(db, "tickets", "operator", "TEXT");
  ensureColumn(db, "tickets", "product_type", "TEXT");
  ensureColumn(db, "tickets", "product_name", "TEXT");
  ensureColumn(db, "tickets", "journeys_included", "INTEGER");
  ensureColumn(db, "tickets", "journeys_used", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "tickets", "route_from", "TEXT");
  ensureColumn(db, "tickets", "route_to", "TEXT");
  ensureColumn(db, "tickets", "amount_cents", "INTEGER");
  ensureColumn(db, "tickets", "currency", "TEXT NOT NULL DEFAULT 'ZAR'");
  ensureColumn(db, "tickets", "valid_from", "DATETIME");
  ensureColumn(db, "tickets", "valid_until", "DATETIME");
  ensureColumn(db, "tickets", "payment_method", "TEXT");
  ensureColumn(db, "tickets", "card_alias", "TEXT");
  ensureColumn(db, "tickets", "meta", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "tickets", "updated_at", "DATETIME NOT NULL DEFAULT (datetime('now'))");

  db.run(`
    UPDATE tickets
    SET amount_cents = CASE
      WHEN amount_cents IS NULL OR amount_cents = 0 THEN CAST(ROUND(coalesce(price, 0) * 100) AS INTEGER)
      ELSE amount_cents
    END
  `);
  db.run(`UPDATE tickets SET currency = coalesce(currency, 'ZAR')`);
  db.run(`UPDATE tickets SET journeys_used = coalesce(journeys_used, 0)`);
  db.run(`UPDATE tickets SET meta = coalesce(nullif(meta, ''), '{}')`);
  db.run(`UPDATE tickets SET updated_at = coalesce(updated_at, purchased_at, datetime('now'))`);
  db.run(`UPDATE tickets SET valid_from = coalesce(valid_from, purchased_at)`);
  db.run(`
    UPDATE tickets
    SET operator = (
      SELECT r.operator
      FROM routes r
      WHERE r.id = tickets.route_id
      LIMIT 1
    )
    WHERE (operator IS NULL OR trim(operator) = '') AND route_id IS NOT NULL
  `);
  db.run(`
    UPDATE tickets
    SET route_from = (
      SELECT coalesce(r.origin, fs.name)
      FROM routes r
      LEFT JOIN stops fs ON fs.id = r.from_stop_id
      WHERE r.id = tickets.route_id
      LIMIT 1
    )
    WHERE (route_from IS NULL OR trim(route_from) = '') AND route_id IS NOT NULL
  `);
  db.run(`
    UPDATE tickets
    SET route_to = (
      SELECT coalesce(r.destination, ts.name)
      FROM routes r
      LEFT JOIN stops ts ON ts.id = r.to_stop_id
      WHERE r.id = tickets.route_id
      LIMIT 1
    )
    WHERE (route_to IS NULL OR trim(route_to) = '') AND route_id IS NOT NULL
  `);
  db.run(`
    UPDATE tickets
    SET product_type = coalesce(product_type, 'single'),
        product_name = coalesce(product_name, route_from || ' - ' || route_to, 'Ticket'),
        payment_method = coalesce(payment_method, 'card')
  `);
}

function seedReferenceData(db) {
  const users = db.exec(`SELECT id, email, operator FROM users ORDER BY email ASC`);
  const userRows = users.length
    ? users[0].values.map((row) => ({
        id: row[0],
        email: row[1],
        operator: row[2],
      }))
    : [];

  userRows.forEach((user) => {
    const operator = normalizeOperator(user.operator);
    if (!operator) return;
    const serviceKey = operator === "Golden Arrow" ? "ga" : "myciti";
    db.run(
      `
      INSERT OR IGNORE INTO user_services (id, user_id, service_key, created_at)
      VALUES (?, ?, ?, datetime('now'))
      `,
      [randomId(), user.id, serviceKey]
    );
  });

  const stopSeeds = [
    ["MyCiTi", "Civic Centre", -33.9249, 18.4241],
    ["MyCiTi", "Cape Town Station", -33.925, 18.424],
    ["MyCiTi", "Gardens", -33.9353, 18.4148],
    ["MyCiTi", "Sea Point", -33.9156, 18.3877],
    ["MyCiTi", "Century City", -33.892, 18.511],
    ["MyCiTi", "Table View", -33.8269, 18.4909],
    ["Golden Arrow", "Cape Town", -33.9249, 18.4241],
    ["Golden Arrow", "Khayelitsha", -34.04, 18.68],
    ["Golden Arrow", "Langa", -33.945, 18.534],
    ["Golden Arrow", "Somerset West", -34.078, 18.856],
  ];

  stopSeeds.forEach(([operator, name, lat, lon]) => {
    const existingStop = firstValue(
      db,
      `
      SELECT id
      FROM stops
      WHERE lower(operator) = lower(?)
        AND lower(name) = lower(?)
      LIMIT 1
      `,
      [operator, name]
    );
    if (existingStop) return;
    db.run(
      `
      INSERT INTO stops (id, operator, name, stop_name, lat, lon, latitude, longitude, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      [randomId(), operator, name, name, lat, lon, lat, lon]
    );
  });

  const stopMapResult = db.exec(`SELECT id, operator, name FROM stops`);
  const stopMap = new Map();
  if (stopMapResult.length) {
    stopMapResult[0].values.forEach((row) => {
      stopMap.set(`${String(row[1]).toLowerCase()}::${String(row[2]).toLowerCase()}`, row[0]);
    });
  }

  const routeSeeds = [
    ["MyCiTi", "T01", "Table Bay", "Civic Centre", "Table View"],
    ["Golden Arrow", "GA101", "Cape Town - Khayelitsha", "Cape Town", "Khayelitsha"],
    ["Golden Arrow", "GA102", "Langa - Cape Town", "Langa", "Cape Town"],
    ["Golden Arrow", "GA103", "Somerset West - Cape Town", "Somerset West", "Cape Town"],
  ];

  routeSeeds.forEach(([operator, routeCode, routeName, fromName, toName]) => {
    const fromStopId = stopMap.get(`${operator.toLowerCase()}::${String(fromName).toLowerCase()}`) || null;
    const toStopId = stopMap.get(`${operator.toLowerCase()}::${String(toName).toLowerCase()}`) || null;
    const existingRoute = firstValue(
      db,
      `
      SELECT id
      FROM routes
      WHERE lower(operator) = lower(?)
        AND lower(route_code) = lower(?)
      LIMIT 1
      `,
      [operator, routeCode]
    );
    if (existingRoute) return;
    db.run(
      `
      INSERT INTO routes (
        id, operator, route_code, route_number, route_name, origin, destination,
        from_stop_id, to_stop_id, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `,
      [randomId(), operator, routeCode, routeCode, routeName, fromName, toName, fromStopId, toStopId]
    );
  });

  const routePriceSeeds = [
    ["Golden Arrow", "Cape Town", "Khayelitsha", 12650, 23400, 103000],
    ["Golden Arrow", "Langa", "Cape Town", 11450, 21200, 93300],
    ["Golden Arrow", "Somerset West", "Cape Town", 14750, 27350, 120300],
  ];

  routePriceSeeds.forEach(([operator, fromName, toName, fiveRide, weekly, monthly]) => {
    const fromStopId = stopMap.get(`${operator.toLowerCase()}::${String(fromName).toLowerCase()}`) || null;
    const toStopId = stopMap.get(`${operator.toLowerCase()}::${String(toName).toLowerCase()}`) || null;
    const exists = firstValue(
      db,
      `
      SELECT id
      FROM route_prices
      WHERE lower(operator) = lower(?)
        AND coalesce(from_stop_id, '') = coalesce(?, '')
        AND coalesce(to_stop_id, '') = coalesce(?, '')
      LIMIT 1
      `,
      [operator, fromStopId, toStopId]
    );
    if (exists) return;
    db.run(
      `
      INSERT INTO route_prices (
        id, operator, from_stop_id, to_stop_id, five_ride_cents, weekly_cents, monthly_cents, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      [randomId(), operator, fromStopId, toStopId, fiveRide, weekly, monthly]
    );
  });

  const fareProducts = [
    ["MyCiTi", "day3", "3-Day Pass", null, 21000],
    ["MyCiTi", "day7", "7-Day Pass", null, 30000],
    ["MyCiTi", "monthly", "Monthly Pass", null, 100000],
    ["Golden Arrow", "five_ride", "5 Ride (5 journeys)", 5, 12650],
    ["Golden Arrow", "weekly", "Weekly (10 journeys)", 10, 23400],
    ["Golden Arrow", "monthly", "Monthly (48 journeys)", 48, 103000],
  ];

  fareProducts.forEach(([operator, productKey, label, journeys, priceCents]) => {
    db.run(
      `
      INSERT OR IGNORE INTO fare_products (
        id, operator, product_key, label, journeys, price_cents, active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `,
      [randomId(), operator, productKey, label, journeys, priceCents]
    );
  });

  const william = userRows.find((user) => String(user.email).toLowerCase() === "william@capeconnect.demo");
  const sihle = userRows.find((user) => String(user.email).toLowerCase() === "sihle@capeconnect.demo");
  if (william) {
    const williamWallet = firstValue(db, `SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1`, [william.id]);
    if (!williamWallet) {
      db.run(
        `
        INSERT INTO wallets (user_id, balance, balance_cents, currency, operator, created_at, updated_at)
        VALUES (?, 100.00, 10000, 'ZAR', 'MyCiTi', datetime('now'), datetime('now'))
        `,
        [william.id]
      );
    } else {
      db.run(
        `
        UPDATE wallets
        SET balance = CASE WHEN coalesce(balance, 0) < 100 THEN 100.00 ELSE balance END,
            balance_cents = CASE WHEN coalesce(balance_cents, 0) < 10000 THEN 10000 ELSE balance_cents END,
            currency = coalesce(currency, 'ZAR'),
            operator = coalesce(operator, 'MyCiTi'),
            updated_at = datetime('now')
        WHERE user_id = ?
        `,
        [william.id]
      );
    }
  }
  if (sihle) {
    const sihleWallet = firstValue(db, `SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1`, [sihle.id]);
    if (!sihleWallet) {
      db.run(
        `
        INSERT INTO wallets (user_id, balance, balance_cents, currency, operator, created_at, updated_at)
        VALUES (?, 150.00, 15000, 'ZAR', 'Golden Arrow', datetime('now'), datetime('now'))
        `,
        [sihle.id]
      );
    } else {
      db.run(
        `
        UPDATE wallets
        SET balance = CASE WHEN coalesce(balance, 0) < 150 THEN 150.00 ELSE balance END,
            balance_cents = CASE WHEN coalesce(balance_cents, 0) < 15000 THEN 15000 ELSE balance_cents END,
            currency = coalesce(currency, 'ZAR'),
            operator = coalesce(operator, 'Golden Arrow'),
            updated_at = datetime('now')
        WHERE user_id = ?
        `,
        [sihle.id]
      );
    }
  }
}

export async function initializeDatabase() {
  if (!config.useSqlite) {
    log('info', 'Using PostgreSQL - run schema.sql manually');
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dbPath = join(__dirname, "..", "capeconnect.db");

  const SQL = await initSqlJs();
  let db;

  if (config.env === "test") {
    db = new SQL.Database();
    log('info', 'SQLite test database initialized from scratch');
  } else if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
    log('info', 'SQLite database loaded');
  } else {
    db = new SQL.Database();
  }

  prepareLegacyTables(db);
  ensureModernTables(db);
  migrateUsers(db);
  migrateSupportTables(db);
  migrateWallets(db);
  migrateStops(db);
  migrateRoutes(db);
  migrateTickets(db);
  seedUsers(db);
  seedReferenceData(db);
  ensureIndexes(db);

  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);

  log('info', 'SQLite database initialized');
}
