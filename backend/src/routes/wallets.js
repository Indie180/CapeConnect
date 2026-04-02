import express from "express";
import { query, withTransaction } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow, walletMutationSchema } from "../utils/validation.js";
import { log, serializeError } from "../utils/logger.js";

const router = express.Router();

let walletSchemaReady = null;

async function ensureWalletSchema() {
  if (walletSchemaReady) return walletSchemaReady;

  walletSchemaReady = (async () => {
    if (config.useSqlite) {
      await query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          ref_ticket_id TEXT,
          note TEXT,
          created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount_cents BIGINT NOT NULL,
          ref_ticket_id UUID,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_unique
      ON wallets(user_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
      ON wallet_transactions(user_id, created_at DESC)
    `);

    if (config.useSqlite) {
      const walletColumnsResult = await query(`PRAGMA table_info(wallets)`);
      const walletColumns = Array.isArray(walletColumnsResult.rows) ? walletColumnsResult.rows : [];
      const hasBalanceCents = walletColumns.some((column) => String(column.name || "").toLowerCase() === "balance_cents");
      const hasCurrency = walletColumns.some((column) => String(column.name || "").toLowerCase() === "currency");
      const hasUpdatedAt = walletColumns.some((column) => String(column.name || "").toLowerCase() === "updated_at");
      if (!hasBalanceCents) {
        await query(`ALTER TABLE wallets ADD COLUMN balance_cents BIGINT DEFAULT 0`);
      }
      if (!hasCurrency) {
        await query(`ALTER TABLE wallets ADD COLUMN currency TEXT DEFAULT 'ZAR'`);
      }
      if (!hasUpdatedAt) {
        await query(`ALTER TABLE wallets ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
      }
      try {
        await query(`
          UPDATE wallets
          SET balance_cents = CASE
            WHEN balance_cents IS NULL OR balance_cents = 0 THEN CAST(ROUND(COALESCE(balance, 0) * 100) AS INTEGER)
            ELSE balance_cents
          END
        `);
      } catch (_err) {
        // Ignore if legacy SQLite balance column is absent.
      }
    }
  })();

  return walletSchemaReady;
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    await ensureWalletSchema();
    const walletResult = await query(
      "SELECT * FROM wallets WHERE user_id = $1 LIMIT 1",
      [req.auth.userId]
    );

    if (!walletResult.rows.length) {
      return res.json({ wallet: { user_id: req.auth.userId, balance_cents: 0, currency: "ZAR" }, transactions: [] });
    }

    const wallet = walletResult.rows[0];
    const txResult = await query(
      `
      SELECT *
      FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [req.auth.userId]
    );

    return res.json({ wallet, transactions: txResult.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/topup", requireAuth, async (req, res, next) => {
  try {
    await ensureWalletSchema();
    const payload = parseOrThrow(walletMutationSchema, req.body || {});
    const amountCents = Number(payload.amountCents || 0);
    const walletOperator = String(req.auth.operator || payload.operator || "MyCiTi");

    const wallet = await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO wallets (user_id, balance_cents, currency, operator, created_at, updated_at)
        VALUES ($1, 0, 'ZAR', $2, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
        `,
        [req.auth.userId, walletOperator]
      );

      const walletResult = await client.query(
        `
        UPDATE wallets
        SET balance_cents = balance_cents + $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
        `,
        [amountCents, req.auth.userId]
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, note, created_at)
        VALUES (gen_random_uuid(), $1, 'TOPUP', $2, $3, NOW())
        `,
        [req.auth.userId, amountCents, payload.note || "Wallet top up"]
      );

      return walletResult.rows[0];
    });

    log("info", "wallet_topup_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
      amountCents,
      balanceCents: wallet.balance_cents,
    });
    return res.json({ wallet });
  } catch (error) {
    log(error?.name === "ZodError" ? "info" : "error", "wallet_topup_error", {
      requestId: req.requestId,
      userId: req.auth?.userId || null,
      error: serializeError(error),
    });
    return next(error);
  }
});

router.post("/spend", requireAuth, async (req, res, next) => {
  try {
    await ensureWalletSchema();
    const payload = parseOrThrow(walletMutationSchema, req.body || {});
    const amountCents = Number(payload.amountCents || 0);
    const walletOperator = String(req.auth.operator || payload.operator || "MyCiTi");

    const wallet = await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO wallets (user_id, balance_cents, currency, operator, created_at, updated_at)
        VALUES ($1, 0, 'ZAR', $2, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
        `,
        [req.auth.userId, walletOperator]
      );

      const balanceResult = await client.query(
        "SELECT balance_cents FROM wallets WHERE user_id = $1 LIMIT 1",
        [req.auth.userId]
      );
      const currentBalance = Number(balanceResult.rows[0]?.balance_cents || 0);
      if (currentBalance < amountCents) {
        log("info", "wallet_spend_rejected", {
          requestId: req.requestId,
          userId: req.auth.userId,
          amountCents,
          currentBalance,
          reason: "insufficient_balance",
        });
        const err = new Error("Insufficient wallet balance");
        err.statusCode = 400;
        throw err;
      }

      const walletResult = await client.query(
        `
        UPDATE wallets
        SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
        `,
        [amountCents, req.auth.userId]
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, note, created_at)
        VALUES (gen_random_uuid(), $1, 'DEBIT', $2, $3, NOW())
        `,
        [req.auth.userId, -amountCents, payload.note || "Wallet spend"]
      );

      return walletResult.rows[0];
    });

    log("info", "wallet_spend_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
      amountCents,
      balanceCents: wallet.balance_cents,
    });
    return res.json({ wallet });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    log("error", "wallet_spend_error", {
      requestId: req.requestId,
      userId: req.auth?.userId || null,
      error: serializeError(error),
    });
    return next(error);
  }
});

export default router;
