import express from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin, requireAdminOperatorScope } from "../middleware/auth.js";

const router = express.Router();

function normalizeOperator(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "myciti" || raw === "mc" || raw === "my-citi") return "MyCiTi";
  if (raw === "golden arrow" || raw === "golden-arrow" || raw === "ga" || raw === "gabs") return "Golden Arrow";
  return input;
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function resolveRequestedOperator(req) {
  return normalizeOperator(req.query?.operator || req.body?.operator || "");
}

async function resolveStopId(operator, stopName, runQuery = query) {
  const name = String(stopName || "").trim();
  if (!name) return null;
  const existing = await runQuery(
    `
    SELECT id
    FROM stops
    WHERE operator = $1 AND name = $2
    LIMIT 1
    `,
    [operator, name]
  );
  if (existing.rows.length) return existing.rows[0].id;
  const inserted = await runQuery(
    `
    INSERT INTO stops (operator, name, code, created_at)
    VALUES ($1, $2, NULL, NOW())
    RETURNING id
    `,
    [operator, name]
  );
  return inserted.rows[0].id;
}

async function resolveRouteId(operator, routeCode, routeName, fromStopName, toStopName, runQuery = query) {
  const code = String(routeCode || "").trim() || null;
  const name = String(routeName || "").trim() || "Route";
  if (code) {
    const existingByCode = await runQuery(
      `
      SELECT id
      FROM routes
      WHERE operator = $1 AND route_code = $2
      LIMIT 1
      `,
      [operator, code]
    );
    if (existingByCode.rows.length) return existingByCode.rows[0].id;
  }
  const existingByName = await runQuery(
    `
    SELECT id
    FROM routes
    WHERE operator = $1 AND route_name = $2
    LIMIT 1
    `,
    [operator, name]
  );
  if (existingByName.rows.length) return existingByName.rows[0].id;

  const fromStopId = fromStopName ? await resolveStopId(operator, fromStopName, runQuery) : null;
  const toStopId = toStopName ? await resolveStopId(operator, toStopName, runQuery) : null;
  const inserted = await runQuery(
    `
    INSERT INTO routes (operator, route_code, route_name, from_stop_id, to_stop_id, active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    RETURNING id
    `,
    [operator, code, name, fromStopId, toStopId]
  );
  return inserted.rows[0].id;
}

router.use(requireAuth, requireAdmin);

router.get("/bootstrap", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.query.operator);
    if (!operator) return res.status(400).json({ error: "operator is required" });

    const usersResult = await query(
      `
      SELECT DISTINCT u.id, u.full_name, u.email, u.phone, u.status, u.blacklist_reason, u.blacklist_until, u.created_at, u.updated_at
      FROM users u
      JOIN tickets t ON t.user_id = u.id
      WHERE t.operator = $1
      ORDER BY u.updated_at DESC
      LIMIT 2000
      `,
      [operator]
    );

    const ticketsResult = await query(
      `
      SELECT id, user_id, operator, product_type, product_name, journeys_included, journeys_used, route_from, route_to,
             amount_cents, currency, status, purchased_at, valid_from, valid_until, payment_method, card_alias, meta
      FROM tickets
      WHERE operator = $1
      ORDER BY purchased_at DESC
      LIMIT 5000
      `,
      [operator]
    );

    const walletsResult = await query(
      `
      SELECT w.user_id, w.balance_cents, w.currency
      FROM wallets w
      WHERE w.user_id IN (
        SELECT DISTINCT t.user_id
        FROM tickets t
        WHERE t.operator = $1
      )
      `,
      [operator]
    );

    const walletTxResult = await query(
      `
      SELECT wt.*
      FROM wallet_transactions wt
      WHERE wt.user_id IN (
        SELECT DISTINCT t.user_id
        FROM tickets t
        WHERE t.operator = $1
      )
      ORDER BY wt.created_at DESC
      LIMIT 10000
      `,
      [operator]
    );

    const globalPricesResult = await query(
      `
      SELECT product_key, label, journeys, price_cents, updated_at
      FROM fare_products
      WHERE operator = $1 AND active = TRUE
      ORDER BY product_key
      `,
      [operator]
    );

    const routePricesResult = await query(
      `
      SELECT rp.id, fs.name AS from_name, ts.name AS to_name, rp.five_ride_cents, rp.weekly_cents, rp.monthly_cents, rp.updated_at
      FROM route_prices rp
      LEFT JOIN stops fs ON fs.id = rp.from_stop_id
      LEFT JOIN stops ts ON ts.id = rp.to_stop_id
      WHERE rp.operator = $1
      ORDER BY fs.name, ts.name
      `,
      [operator]
    );

    const timetablesResult = await query(
      `
      SELECT t.id, r.route_name, r.route_code, t.direction, t.day_type, t.stops_json, t.times_json,
             t.status, t.effective_from, t.updated_at, t.deleted, t.version
      FROM timetables t
      JOIN routes r ON r.id = t.route_id
      WHERE r.operator = $1
      ORDER BY t.updated_at DESC
      LIMIT 3000
      `,
      [operator]
    );

    const auditResult = await query(
      `
      SELECT id, at, operator, admin_email, action, target_type, target_id, before_json, after_json
      FROM audit_logs
      WHERE operator = $1
      ORDER BY at DESC
      LIMIT 3000
      `,
      [operator]
    );

    const txByUser = new Map();
    walletTxResult.rows.forEach((tx) => {
      const key = String(tx.user_id || "");
      if (!txByUser.has(key)) txByUser.set(key, []);
      txByUser.get(key).push({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount_cents || 0) / 100,
        at: tx.created_at,
        refTicketId: tx.ref_ticket_id || "",
        note: tx.note || ""
      });
    });

    const users = usersResult.rows.map((u) => ({
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone || "",
      status: u.status,
      blacklistReason: u.blacklist_reason || "",
      blacklistUntil: u.blacklist_until || "",
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));

    const tickets = ticketsResult.rows.map((t) => ({
      id: t.id,
      userId: t.user_id,
      operator: t.operator,
      productType: t.product_type,
      productName: t.product_name,
      journeysIncluded: Number(t.journeys_included || 0),
      journeysUsed: Number(t.journeys_used || 0),
      routeFrom: t.route_from || "",
      routeTo: t.route_to || "",
      amount: Number(t.amount_cents || 0) / 100,
      currency: t.currency || "ZAR",
      status: t.status,
      purchasedAt: t.purchased_at,
      validFrom: t.valid_from,
      validUntil: t.valid_until,
      paymentMethod: t.payment_method,
      cardAlias: t.card_alias || "",
      meta: t.meta || {}
    }));

    const wallets = walletsResult.rows.map((w) => ({
      userId: w.user_id,
      balance: Number(w.balance_cents || 0) / 100,
      currency: w.currency || "ZAR",
      transactions: txByUser.get(String(w.user_id || "")) || []
    }));

    const pricesGlobal = globalPricesResult.rows.map((p) => ({
      key: p.product_key,
      label: p.label,
      journeys: Number(p.journeys || 0),
      price: Number(p.price_cents || 0) / 100,
      updatedAt: p.updated_at
    }));

    const pricesRoutes = routePricesResult.rows.map((r) => ({
      id: r.id,
      from: r.from_name || "",
      to: r.to_name || "",
      five_ride: Number(r.five_ride_cents || 0) / 100,
      weekly: Number(r.weekly_cents || 0) / 100,
      monthly: Number(r.monthly_cents || 0) / 100,
      updatedAt: r.updated_at
    }));

    const timetables = timetablesResult.rows.map((t) => ({
      id: t.id,
      routeName: t.route_name,
      routeCode: t.route_code || "",
      direction: t.direction,
      dayType: t.day_type,
      stops: Array.isArray(t.stops_json) ? t.stops_json : [],
      times: Array.isArray(t.times_json) ? t.times_json : [],
      status: t.status,
      effectiveFrom: t.effective_from,
      updatedAt: t.updated_at,
      deleted: Boolean(t.deleted),
      versions: []
    }));

    const audit = auditResult.rows.map((a) => ({
      id: a.id,
      at: a.at,
      operator: a.operator,
      adminEmail: a.admin_email,
      action: a.action,
      targetType: a.target_type,
      targetId: a.target_id,
      before: a.before_json || null,
      after: a.after_json || null
    }));

    return res.json({ users, tickets, wallets, pricesGlobal, pricesRoutes, timetables, audit });
  } catch (error) {
    return next(error);
  }
});

router.post("/users/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      for (const user of users) {
        if (!isUuid(user?.id)) continue;
        await client.query(
          `
          UPDATE users
          SET full_name = $1,
              email = $2,
              phone = $3,
              status = $4,
              blacklist_reason = $5,
              blacklist_until = $6,
              updated_at = NOW()
          WHERE id = $7
            AND EXISTS (
              SELECT 1 FROM tickets t
              WHERE t.user_id = users.id
                AND t.operator = $8
            )
          `,
          [
            String(user.fullName || "").trim() || "User",
            String(user.email || "").trim().toLowerCase(),
            String(user.phone || "").trim() || null,
            String(user.status || "ACTIVE"),
            String(user.blacklistReason || "").trim() || null,
            user.blacklistUntil || null,
            user.id,
            operator
          ]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/tickets/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const tickets = Array.isArray(req.body?.tickets) ? req.body.tickets : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      await client.query("DELETE FROM tickets WHERE operator = $1", [operator]);
      for (const t of tickets) {
        if (!isUuid(t?.userId)) continue;
        await client.query(
          `
          INSERT INTO tickets (
            id, user_id, operator, product_type, product_name, journeys_included, journeys_used,
            route_from, route_to, amount_cents, currency, status, purchased_at, valid_from, valid_until,
            payment_method, card_alias, meta, updated_at
          )
          VALUES (
            COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, COALESCE($13, NOW()), $14, $15, $16, $17, $18::jsonb, NOW()
          )
          `,
          [
            isUuid(t?.id) ? t.id : null,
            t.userId,
            operator,
            String(t.productType || "JOURNEY"),
            String(t.productName || "Ticket"),
            Number(t.journeysIncluded || 0) || null,
            Number(t.journeysUsed || 0),
            String(t.routeFrom || "") || null,
            String(t.routeTo || "") || null,
            Math.round(Number(t.amount || 0) * 100),
            String(t.currency || "ZAR"),
            String(t.status || "PAID"),
            t.purchasedAt || null,
            t.validFrom || null,
            t.validUntil || null,
            String(t.paymentMethod || "CARD"),
            String(t.cardAlias || "") || null,
            JSON.stringify(t.meta || {})
          ]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/wallets/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const wallets = Array.isArray(req.body?.wallets) ? req.body.wallets : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      for (const w of wallets) {
        if (!isUuid(w?.userId)) continue;
        const allowedUser = await client.query(
          `
          SELECT 1
          FROM tickets
          WHERE user_id = $1
            AND operator = $2
          LIMIT 1
          `,
          [w.userId, operator]
        );
        if (!allowedUser.rows.length) continue;

        const balanceCents = Math.round(Number(w.balance || 0) * 100);
        await client.query(
          `
          INSERT INTO wallets (user_id, balance_cents, currency, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE
          SET balance_cents = EXCLUDED.balance_cents,
              currency = EXCLUDED.currency,
              updated_at = NOW()
          `,
          [w.userId, balanceCents, String(w.currency || "ZAR")]
        );

        await client.query("DELETE FROM wallet_transactions WHERE user_id = $1", [w.userId]);
        const txs = Array.isArray(w.transactions) ? w.transactions : [];
        for (const tx of txs) {
          await client.query(
            `
            INSERT INTO wallet_transactions (id, user_id, type, amount_cents, ref_ticket_id, note, created_at)
            VALUES (
              COALESCE($1::uuid, gen_random_uuid()),
              $2, $3, $4, $5, $6, COALESCE($7, NOW())
            )
            `,
            [
              isUuid(tx?.id) ? tx.id : null,
              w.userId,
              String(tx.type || "ADJUST"),
              Math.round(Number(tx.amount || 0) * 100),
              isUuid(tx?.refTicketId) ? tx.refTicketId : null,
              String(tx.note || "") || null,
              tx.at || null
            ]
          );
        }
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/prices/global/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const prices = Array.isArray(req.body?.pricesGlobal) ? req.body.pricesGlobal : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      for (const p of prices) {
        const key = String(p.key || "").trim();
        if (!key) continue;
        await client.query(
          `
          INSERT INTO fare_products (operator, product_key, label, journeys, price_cents, active, updated_at)
          VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
          ON CONFLICT (operator, product_key) DO UPDATE
          SET label = EXCLUDED.label,
              journeys = EXCLUDED.journeys,
              price_cents = EXCLUDED.price_cents,
              active = TRUE,
              updated_at = NOW()
          `,
          [
            operator,
            key,
            String(p.label || key),
            Number(p.journeys || 0) || null,
            Math.round(Number(p.price || 0) * 100)
          ]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/prices/routes/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const rows = Array.isArray(req.body?.pricesRoutes) ? req.body.pricesRoutes : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      await client.query("DELETE FROM route_prices WHERE operator = $1", [operator]);
      for (const row of rows) {
        const fromStop = String(row.from || "").trim();
        const toStop = String(row.to || "").trim();
        if (!fromStop || !toStop) continue;
        const txQuery = (sql, params) => client.query(sql, params);
        const fromId = await resolveStopId(operator, fromStop, txQuery);
        const toId = await resolveStopId(operator, toStop, txQuery);
        await client.query(
          `
          INSERT INTO route_prices (id, operator, from_stop_id, to_stop_id, five_ride_cents, weekly_cents, monthly_cents, updated_at)
          VALUES (
            COALESCE($1::uuid, gen_random_uuid()),
            $2, $3, $4, $5, $6, $7, NOW()
          )
          `,
          [
            isUuid(row?.id) ? row.id : null,
            operator,
            fromId,
            toId,
            Math.round(Number(row.five_ride || 0) * 100),
            Math.round(Number(row.weekly || 0) * 100),
            Math.round(Number(row.monthly || 0) * 100)
          ]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/timetables/bulk", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    const timetables = Array.isArray(req.body?.timetables) ? req.body.timetables : [];
    if (!operator) return res.status(400).json({ error: "operator is required" });
    await withTransaction(async (client) => {
      await client.query(
        `
        DELETE FROM timetables
        WHERE route_id IN (
          SELECT id FROM routes WHERE operator = $1
        )
        `,
        [operator]
      );

      for (const tt of timetables) {
        const routeName = String(tt.routeName || "").trim();
        if (!routeName) continue;
        const stops = Array.isArray(tt.stops) ? tt.stops : [];
        const fromStop = String(stops[0]?.name || "").trim() || null;
        const toStop = String(stops[stops.length - 1]?.name || "").trim() || null;
        const txQuery = (sql, params) => client.query(sql, params);
        const routeId = await resolveRouteId(operator, tt.routeCode, routeName, fromStop, toStop, txQuery);
        await client.query(
          `
          INSERT INTO timetables (
            id, route_id, direction, day_type, stops_json, times_json, status, effective_from, version, deleted, updated_at
          )
          VALUES (
            COALESCE($1::uuid, gen_random_uuid()),
            $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, NOW()
          )
          `,
          [
            isUuid(tt?.id) ? tt.id : null,
            routeId,
            String(tt.direction || "Outbound"),
            String(tt.dayType || "Weekday"),
            JSON.stringify(stops),
            JSON.stringify(Array.isArray(tt.times) ? tt.times : []),
            String(tt.status || "DRAFT"),
            tt.effectiveFrom || null,
            1,
            Boolean(tt.deleted)
          ]
        );
      }
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/audit", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.query?.operator);
    if (!operator) return res.status(400).json({ error: "operator is required" });
    const result = await query(
      `
      SELECT id, at, operator, admin_email, action, target_type, target_id, before_json, after_json
      FROM audit_logs
      WHERE operator = $1
      ORDER BY at DESC
      LIMIT 3000
      `,
      [operator]
    );
    return res.json({
      audit: result.rows.map((a) => ({
        id: a.id,
        at: a.at,
        operator: a.operator,
        adminEmail: a.admin_email,
        action: a.action,
        targetType: a.target_type,
        targetId: a.target_id,
        before: a.before_json || null,
        after: a.after_json || null
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/audit", requireAdminOperatorScope(resolveRequestedOperator), async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.body?.operator);
    if (!operator) return res.status(400).json({ error: "operator is required" });
    const entry = req.body?.entry || {};
    await query(
      `
      INSERT INTO audit_logs (id, at, operator, admin_email, action, target_type, target_id, before_json, after_json)
      VALUES (
        COALESCE($1::uuid, gen_random_uuid()),
        COALESCE($2, NOW()),
        $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb
      )
      `,
      [
        isUuid(entry?.id) ? entry.id : null,
        entry?.at || null,
        operator,
        String(entry?.adminEmail || req.auth.email || "admin@capeconnect.demo"),
        String(entry?.action || "ADMIN_ACTION"),
        String(entry?.targetType || "UNKNOWN"),
        String(entry?.targetId || ""),
        JSON.stringify(entry?.before || null),
        JSON.stringify(entry?.after || null)
      ]
    );
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
