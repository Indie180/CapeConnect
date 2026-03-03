import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { config } from "../config.js";
import { getTokenHash, requireAuth } from "../middleware/auth.js";

const router = express.Router();

let refreshSchemaReady = null;

async function ensureRefreshSchema() {
  if (refreshSchemaReady) return refreshSchemaReady;
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

function makeRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function issueAccessToken(userId) {
  const token = makeRawToken();
  const tokenHash = getTokenHash(token);
  const expiresAt = new Date(Date.now() + config.sessionTtlMinutes * 60 * 1000);

  await query(
    `
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW())
    `,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return { token, expiresAt: expiresAt.toISOString(), tokenHash };
}

async function issueRefreshToken(userId) {
  await ensureRefreshSchema();
  const refreshToken = makeRawToken();
  const refreshTokenHash = getTokenHash(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000);

  await query(
    `
    INSERT INTO refresh_sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW())
    `,
    [userId, refreshTokenHash, refreshExpiresAt.toISOString()]
  );

  return {
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    refreshTokenHash,
  };
}

router.post("/login", async (req, res, next) => {
  try {
    await ensureRefreshSchema();

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const userResult = await query(
      `
      SELECT id, email, full_name, role, status, password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [String(email).toLowerCase().trim()]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "User is not active" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const access = await issueAccessToken(user.id);
    const refresh = await issueRefreshToken(user.id);

    return res.json({
      token: access.token,
      expiresAt: access.expiresAt,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
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
      SELECT rs.*, u.email, u.full_name, u.role, u.status
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

    return res.json({
      token: access.token,
      expiresAt: access.expiresAt,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.refreshExpiresAt,
      user: {
        id: rs.user_id,
        email: rs.email,
        fullName: rs.full_name,
        role: rs.role,
      },
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

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: {
      id: req.auth.userId,
      email: req.auth.email,
      fullName: req.auth.fullName,
      role: req.auth.role,
      status: req.auth.status,
    },
  });
});

export default router;
