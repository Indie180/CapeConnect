import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { config } from "../config.js";
import { getTokenHash, requireAuth } from "../middleware/auth.js";
import {
  authChangePasswordSchema,
  authForgotPasswordSchema,
  authLoginSchema,
  authRegisterSchema,
  authResetPasswordSchema,
  parseOrThrow,
} from "../utils/validation.js";
import {
  checkAccountLockout,
  handleFailedLogin,
  handleSuccessfulLogin,
} from "../middleware/accountSecurity.js";
import { log, logAlert, serializeError } from "../utils/logger.js";

function logAuthRouteError(req, code, error, severity = "high") {
  const meta = {
    requestId: req.requestId,
    error: serializeError(error),
  };

  if (error?.name === "ZodError") {
    log("info", code, meta);
    return;
  }

  logAlert(code, meta, {
    category: "auth",
    severity,
    code,
  });
}

const router = express.Router();

let refreshSchemaReady = null;
let userSchemaReady = null;
let passwordResetSchemaReady = null;

function idExpression() {
  return config.useSqlite ? "lower(hex(randomblob(16)))" : "gen_random_uuid()";
}

async function ensureUserSchema() {
  if (userSchemaReady) return userSchemaReady;

  userSchemaReady = (async () => {
    if (config.useSqlite) {
      const columnsResult = await query(`PRAGMA table_info(users)`);
      const columns = Array.isArray(columnsResult.rows) ? columnsResult.rows : [];
      const hasOperator = columns.some((column) => String(column.name || "").toLowerCase() === "operator");
      const hasPhone = columns.some((column) => String(column.name || "").toLowerCase() === "phone");
      if (!hasOperator) {
        await query(`
          ALTER TABLE users
          ADD COLUMN operator TEXT
        `);
      }
      if (!hasPhone) {
        await query(`
          ALTER TABLE users
          ADD COLUMN phone TEXT
        `);
      }
    } else {
      await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS operator TEXT
      `);
      await query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS phone TEXT
      `);
    }
    if (config.useSqlite) {
      await query(`
        CREATE TABLE IF NOT EXISTS user_services (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          service_key TEXT NOT NULL
        )
      `);
      await query(`
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
        )
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS user_services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          service_key TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS user_banking_profiles (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          bank_name TEXT,
          branch_name TEXT,
          branch_code TEXT,
          country TEXT,
          account_number TEXT,
          account_type TEXT,
          currency TEXT,
          account_holder_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_services_user_service
      ON user_services(user_id, service_key)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_services_user_id
      ON user_services(user_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_banking_profiles_updated
      ON user_banking_profiles(updated_at)
    `);
    await query(`
      INSERT INTO user_services (id, user_id, service_key)
      SELECT ${idExpression()}, id, operator
      FROM users
      WHERE operator IS NOT NULL AND trim(operator) <> ''
      ON CONFLICT (user_id, service_key) DO NOTHING
    `);
  })();

  return userSchemaReady;
}

async function getUserBankingProfile(userId) {
  const result = await query(
    `
    SELECT bank_name, branch_name, branch_code, country, account_number, account_type, currency, account_holder_confirmed
    FROM user_banking_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );
  const row = result.rows[0];
  return {
    bankName: row?.bank_name || "",
    branchName: row?.branch_name || "",
    branchCode: row?.branch_code || "",
    country: row?.country || "South Africa",
    accountNumber: row?.account_number || "",
    accountType: row?.account_type || "savings",
    currency: row?.currency || "ZAR",
    accountHolderConfirmed: Boolean(row?.account_holder_confirmed),
  };
}

async function syncUserBankingProfile(userId, bankDetails) {
  if (!bankDetails || typeof bankDetails !== "object") {
    return getUserBankingProfile(userId);
  }

  const normalized = {
    bankName: String(bankDetails.bankName || "").trim(),
    branchName: String(bankDetails.branchName || "").trim(),
    branchCode: String(bankDetails.branchCode || "").trim(),
    country: String(bankDetails.country || "South Africa").trim() || "South Africa",
    accountNumber: String(bankDetails.accountNumber || "").trim(),
    accountType: String(bankDetails.accountType || "savings").trim() || "savings",
    currency: String(bankDetails.currency || "ZAR").trim() || "ZAR",
    accountHolderConfirmed: Boolean(bankDetails.accountHolderConfirmed),
  };

  await query(
    `
    INSERT INTO user_banking_profiles (
      user_id, bank_name, branch_name, branch_code, country,
      account_number, account_type, currency, account_holder_confirmed, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET bank_name = EXCLUDED.bank_name,
        branch_name = EXCLUDED.branch_name,
        branch_code = EXCLUDED.branch_code,
        country = EXCLUDED.country,
        account_number = EXCLUDED.account_number,
        account_type = EXCLUDED.account_type,
        currency = EXCLUDED.currency,
        account_holder_confirmed = EXCLUDED.account_holder_confirmed,
        updated_at = NOW()
    `,
    [
      userId,
      normalized.bankName || null,
      normalized.branchName || null,
      normalized.branchCode || null,
      normalized.country || "South Africa",
      normalized.accountNumber || null,
      normalized.accountType || "savings",
      normalized.currency || "ZAR",
      normalized.accountHolderConfirmed,
    ]
  );

  return getUserBankingProfile(userId);
}

function normalizeServiceKey(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (!raw) return "";
  if (raw === "ga" || raw === "golden_arrow" || raw === "golden arrow" || raw === "golden-arrow") return "ga";
  if (raw === "myciti") return "myciti";
  return "";
}

function uniqueServices(values) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map(normalizeServiceKey).filter(Boolean))
  );
}

async function getUserServices(userId, fallbackOperator = null) {
  const result = await query(
    `
    SELECT service_key
    FROM user_services
    WHERE user_id = $1
    ORDER BY service_key ASC
    `,
    [userId]
  );
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const services = uniqueServices(rows.map((row) => row.service_key));
  const fallback = normalizeServiceKey(fallbackOperator);
  return fallback ? uniqueServices([...services, fallback]) : services;
}

async function syncUserServices(userId, services, operator = null) {
  const normalizedOperator = normalizeServiceKey(operator);
  const hasExplicitServices = Array.isArray(services);
  const nextServices = uniqueServices([
    ...(hasExplicitServices ? services : []),
    ...(normalizedOperator ? [normalizedOperator] : []),
  ]);

  if (hasExplicitServices) {
    await query(`DELETE FROM user_services WHERE user_id = $1`, [userId]);
  }

  if (hasExplicitServices || normalizedOperator) {
    for (const serviceKey of nextServices) {
      await query(
        `
        INSERT INTO user_services (id, user_id, service_key)
        VALUES (${idExpression()}, $1, $2)
        ON CONFLICT (user_id, service_key) DO NOTHING
        `,
        [userId, serviceKey]
      );
    }
  }

  return getUserServices(userId, normalizedOperator);
}

async function buildFrontendUser(userRow) {
  const buses = await getUserServices(userRow.id, userRow.operator || null);
  const bankDetails = await getUserBankingProfile(userRow.id);
  return {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    phone: userRow.phone || "",
    role: userRow.role,
    status: userRow.status,
    operator: normalizeServiceKey(userRow.operator || null) || null,
    buses,
    bankDetails,
  };
}

async function ensureRefreshSchema() {
  if (refreshSchemaReady) return refreshSchemaReady;
  
  // Skip for SQLite - table already created in init-db.js
  if (config.useSqlite) {
    refreshSchemaReady = Promise.resolve();
    return refreshSchemaReady;
  }
  
  refreshSchemaReady = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        replaced_by_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id
      ON refresh_sessions(user_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token_hash
      ON refresh_sessions(token_hash);
    `);
  })();
  return refreshSchemaReady;
}

async function ensurePasswordResetSchema() {
  if (passwordResetSchemaReady) return passwordResetSchemaReady;

  passwordResetSchemaReady = (async () => {
    if (config.useSqlite) {
      await query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          used_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
    await query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
      ON password_reset_tokens(user_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
      ON password_reset_tokens(token_hash)
    `);
  })();

  return passwordResetSchemaReady;
}

function makeRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

function issuePasswordResetToken() {
  const token = makeRawToken();
  const tokenHash = getTokenHash(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return { token, tokenHash, expiresAt: expiresAt.toISOString() };
}

async function issueAccessToken(userId) {
  const token = makeRawToken();
  const tokenHash = getTokenHash(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlMinutes * 60 * 1000);

  const sessionId = crypto.randomBytes(16).toString('hex');

  await query(
    `
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    `,
    [sessionId, userId, tokenHash, expiresAt.toISOString()]
  );

  return { token, expiresAt: expiresAt.toISOString(), tokenHash };
}

async function issueRefreshToken(userId) {
  await ensureRefreshSchema();
  const refreshToken = makeRawToken();
  const refreshTokenHash = getTokenHash(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000);

  const refreshId = crypto.randomBytes(16).toString('hex');

  await query(
    `
    INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    `,
    [refreshId, userId, refreshTokenHash, refreshExpiresAt.toISOString()]
  );

  return {
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    refreshTokenHash,
  };
}

router.post("/login", checkAccountLockout, async (req, res, next) => {
  try {
    await ensureUserSchema();
    await ensureRefreshSchema();

    const { email, password } = parseOrThrow(authLoginSchema, req.body || {});

    const userResult = await query(
      `
      SELECT id, email, full_name, phone, role, status, password_hash, operator
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [String(email).toLowerCase().trim()]
    );

    if (!userResult.rows.length) {
      log("info", "auth_login_failed", {
        requestId: req.requestId,
        reason: "user_not_found",
        email,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];
    if (user.status !== "ACTIVE") {
      log("info", "auth_login_blocked", {
        requestId: req.requestId,
        reason: "inactive_user",
        userId: user.id,
        email: user.email,
        status: user.status,
      });
      return res.status(403).json({ error: "User is not active" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await handleFailedLogin(user.email);
      log("info", "auth_login_failed", {
        requestId: req.requestId,
        reason: "invalid_password",
        userId: user.id,
        email: user.email,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await handleSuccessfulLogin(user.email);

    const access = await issueAccessToken(user.id);
    const refresh = await issueRefreshToken(user.id);

    const frontendUser = await buildFrontendUser(user);

    log("info", "auth_login_succeeded", {
      requestId: req.requestId,
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      token: access.token,
      expiresAt: access.expiresAt,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.refreshExpiresAt,
      user: frontendUser,
    });
  } catch (error) {
    logAuthRouteError(req, "auth_login_error", error, "high");
    return next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    await ensureUserSchema();
    await ensureRefreshSchema();

    const parsed = parseOrThrow(authRegisterSchema, req.body || {});
    const fullName = parsed.fullName.trim();
    const email = parsed.email.toLowerCase().trim();
    const phone = String(parsed.phone || "").trim() || null;
    const password = parsed.password;

    const existingUser = await query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if (existingUser.rows.length) {
      log("info", "auth_register_conflict", {
        requestId: req.requestId,
        email,
      });
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const userId = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      `
      INSERT INTO users (id, full_name, email, phone, password_hash, role, status, operator)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [userId, fullName, email, phone, passwordHash, "passenger", "ACTIVE", null]
    );

    const access = await issueAccessToken(userId);
    const refresh = await issueRefreshToken(userId);

    const frontendUser = await buildFrontendUser({
      id: userId,
      email,
      full_name: fullName,
      phone,
      role: "passenger",
      status: "ACTIVE",
      operator: null,
    });

    log("info", "auth_register_succeeded", {
      requestId: req.requestId,
      userId,
      email,
    });

    return res.status(201).json({
      token: access.token,
      expiresAt: access.expiresAt,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.refreshExpiresAt,
      user: frontendUser,
    });
  } catch (error) {
    logAuthRouteError(req, "auth_register_error", error, "high");
    return next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    await ensureUserSchema();
    await ensurePasswordResetSchema();

    const { email: rawEmail } = parseOrThrow(authForgotPasswordSchema, req.body || {});
    const email = rawEmail.toLowerCase().trim();

    const userResult = await query(
      `
      SELECT id, email, status
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    const genericResponse = {
      ok: true,
      message: "If an account with that email exists, a password reset link has been issued.",
    };

    if (!userResult.rows.length || String(userResult.rows[0].status || "").toUpperCase() !== "ACTIVE") {
      log("info", "auth_forgot_password_ignored", {
        requestId: req.requestId,
        email,
      });
      return res.json(genericResponse);
    }

    const user = userResult.rows[0];
    await query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL
      `,
      [user.id]
    );

    const reset = issuePasswordResetToken();
    await query(
      `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (${idExpression()}, $1, $2, $3)
      `,
      [user.id, reset.tokenHash, reset.expiresAt]
    );

    const payload = { ...genericResponse };
    if (config.env !== "production") {
      payload.resetToken = reset.token;
      payload.resetUrl = `/reset-password.html?token=${encodeURIComponent(reset.token)}`;
    }

    log("info", "auth_forgot_password_issued", {
      requestId: req.requestId,
      userId: user.id,
      email: user.email,
    });
    return res.json(payload);
  } catch (error) {
    logAuthRouteError(req, "auth_forgot_password_error", error, "medium");
    return next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    await ensurePasswordResetSchema();

    const parsed = parseOrThrow(authResetPasswordSchema, req.body || {});
    const token = parsed.token.trim();
    const newPassword = parsed.newPassword;

    const tokenHash = getTokenHash(token);
    const resetResult = await query(
      `
      SELECT prt.user_id, prt.expires_at, prt.used_at, u.status
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    const resetRow = resetResult.rows[0];
    if (!resetRow) {
      log("info", "auth_reset_password_failed", {
        requestId: req.requestId,
        reason: "token_not_found",
      });
      return res.status(400).json({ error: "Reset token is invalid" });
    }
    if (resetRow.used_at) {
      log("info", "auth_reset_password_failed", {
        requestId: req.requestId,
        reason: "token_used",
        userId: resetRow.user_id,
      });
      return res.status(400).json({ error: "Reset token has already been used" });
    }
    if (new Date(resetRow.expires_at).getTime() <= Date.now()) {
      log("info", "auth_reset_password_failed", {
        requestId: req.requestId,
        reason: "token_expired",
        userId: resetRow.user_id,
      });
      return res.status(400).json({ error: "Reset token has expired" });
    }
    if (String(resetRow.status || "").toUpperCase() !== "ACTIVE") {
      log("info", "auth_reset_password_blocked", {
        requestId: req.requestId,
        reason: "inactive_user",
        userId: resetRow.user_id,
        status: resetRow.status,
      });
      return res.status(403).json({ error: "User is not active" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, resetRow.user_id]
    );

    await query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
      `,
      [tokenHash]
    );

    await query(
      `
      DELETE FROM sessions
      WHERE user_id = $1
      `,
      [resetRow.user_id]
    );
    await query(
      `
      UPDATE refresh_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
      `,
      [resetRow.user_id]
    );

    log("info", "auth_reset_password_succeeded", {
      requestId: req.requestId,
      userId: resetRow.user_id,
    });
    return res.json({ ok: true });
  } catch (error) {
    logAuthRouteError(req, "auth_reset_password_error", error, "high");
    return next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    await ensureRefreshSchema();
    const refreshToken = String(req.body?.refreshToken || "").trim();
    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const refreshHash = getTokenHash(refreshToken);
    const sessionResult = await query(
      `
      SELECT rs.*, u.email, u.full_name, u.phone, u.role, u.status, u.operator
      FROM refresh_sessions rs
      JOIN users u ON u.id = rs.user_id
      WHERE rs.token_hash = $1
      LIMIT 1
      `,
      [refreshHash]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const rs = sessionResult.rows[0];
    if (rs.revoked_at) {
      return res.status(401).json({ error: "Refresh token revoked" });
    }
    if (new Date(rs.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ error: "Refresh token expired" });
    }
    if (rs.status !== "ACTIVE") {
      return res.status(403).json({ error: "User is not active" });
    }

    const access = await issueAccessToken(rs.user_id);
    const refresh = await issueRefreshToken(rs.user_id);

    await query(
      `
      UPDATE refresh_sessions
      SET revoked_at = NOW(), replaced_by_hash = $1
      WHERE token_hash = $2
      `,
      [refresh.refreshTokenHash, refreshHash]
    );

    const frontendUser = await buildFrontendUser({
      id: rs.user_id,
      email: rs.email,
      full_name: rs.full_name,
      phone: rs.phone || "",
      role: rs.role,
      status: rs.status,
      operator: rs.operator || null,
    });

    return res.json({
      token: access.token,
      expiresAt: access.expiresAt,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.refreshExpiresAt,
      user: frontendUser,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await ensureRefreshSchema();
    const refreshToken = String(req.body?.refreshToken || "").trim();
    const refreshTokenHash = refreshToken ? getTokenHash(refreshToken) : null;

    await query("DELETE FROM sessions WHERE token_hash = $1", [req.auth.tokenHash]);

    if (refreshTokenHash) {
      await query(
        `
        UPDATE refresh_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
        `,
        [req.auth.userId, refreshTokenHash]
      );
    } else {
      await query(
        `
        UPDATE refresh_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [req.auth.userId]
      );
    }

    log("info", "auth_logout_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error?.name === "ZodError") {
      log("info", "auth_logout_error", {
        requestId: req.requestId,
        userId: req.auth?.userId || null,
        error: serializeError(error),
      });
    } else {
      logAlert("auth_logout_error", {
        requestId: req.requestId,
        userId: req.auth?.userId || null,
        error: serializeError(error),
      }, {
        category: "auth",
        severity: "medium",
        code: "auth_logout_error",
      });
    }
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    await ensureUserSchema();
    const frontendUser = await buildFrontendUser({
      id: req.auth.userId,
      email: req.auth.email,
      full_name: req.auth.fullName,
      phone: req.auth.phone || "",
      role: req.auth.role,
      status: req.auth.status,
      operator: req.auth.operator || null,
    });
    return res.json({ user: frontendUser });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    await ensureUserSchema();

    const updates = [];
    const params = [];

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "fullName")) {
      const fullName = String(req.body.fullName || "").trim();
      if (!fullName) {
        return res.status(400).json({ error: "fullName cannot be empty" });
      }
      params.push(fullName);
      updates.push(`full_name = $${params.length}`);
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "phone")) {
      const phone = String(req.body.phone || "").trim();
      params.push(phone || null);
      updates.push(`phone = $${params.length}`);
    }

    let nextBuses = null;
    let nextBankDetails = null;

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "operator")) {
      const rawOperator = String(req.body.operator || "").toLowerCase().trim();
      const operator = normalizeServiceKey(rawOperator);

      if (rawOperator && !operator) {
        return res.status(400).json({ error: "operator must be one of: myciti, ga" });
      }

      params.push(operator);
      updates.push(`operator = $${params.length}`);
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "buses")) {
      if (!Array.isArray(req.body.buses)) {
        return res.status(400).json({ error: "buses must be an array" });
      }
      nextBuses = uniqueServices(req.body.buses);
    } else if (req.body && Object.prototype.hasOwnProperty.call(req.body, "linkedServices")) {
      if (!Array.isArray(req.body.linkedServices)) {
        return res.status(400).json({ error: "linkedServices must be an array" });
      }
      nextBuses = uniqueServices(req.body.linkedServices);
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "bankDetails")) {
      if (!req.body.bankDetails || typeof req.body.bankDetails !== "object" || Array.isArray(req.body.bankDetails)) {
        return res.status(400).json({ error: "bankDetails must be an object" });
      }
      nextBankDetails = req.body.bankDetails;
    }

    if (!updates.length && nextBuses === null && nextBankDetails === null) {
      return res.status(400).json({ error: "No supported fields were provided" });
    }

    let user = null;
    if (updates.length) {
      params.push(req.auth.userId);
      const result = await query(
        `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${params.length}
        RETURNING id, email, full_name, phone, role, status, operator
        `,
        params
      );
      user = result.rows[0];
    } else {
      const result = await query(
        `
        SELECT id, email, full_name, phone, role, status, operator
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [req.auth.userId]
      );
      user = result.rows[0];
    }

    const buses = await syncUserServices(user.id, nextBuses, user.operator || null);
    const bankDetails = await syncUserBankingProfile(user.id, nextBankDetails);
    const frontendUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone || "",
      role: user.role,
      status: user.status,
      operator: normalizeServiceKey(user.operator || null) || null,
      buses,
      bankDetails,
    };

    return res.json({
      user: frontendUser,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const parsed = parseOrThrow(authChangePasswordSchema, req.body || {});
    const currentPassword = parsed.currentPassword;
    const newPassword = parsed.newPassword;

    const userResult = await query(
      `
      SELECT id, password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [req.auth.userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      log("info", "auth_change_password_failed", {
        requestId: req.requestId,
        reason: "user_not_found",
        userId: req.auth.userId,
      });
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) {
      log("info", "auth_change_password_failed", {
        requestId: req.requestId,
        reason: "invalid_current_password",
        userId: req.auth.userId,
      });
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const nextHash = await bcrypt.hash(newPassword, 10);
    await query(
      `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [nextHash, req.auth.userId]
    );

    log("info", "auth_change_password_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
    });
    return res.json({ ok: true });
  } catch (error) {
    if (error?.name === "ZodError") {
      log("info", "auth_change_password_error", {
        requestId: req.requestId,
        userId: req.auth?.userId || null,
        error: serializeError(error),
      });
    } else {
      logAlert("auth_change_password_error", {
        requestId: req.requestId,
        userId: req.auth?.userId || null,
        error: serializeError(error),
      }, {
        category: "auth",
        severity: "high",
        code: "auth_change_password_error",
      });
    }
    return next(error);
  }
});

export default router;
