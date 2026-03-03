import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { operator, status, from, to } = req.query;
    const where = ["user_id = $1"];
    const params = [req.auth.userId];

    if (operator) {
      params.push(operator);
      where.push(`operator = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`route_from = $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`route_to = $${params.length}`);
    }

    const result = await query(
      `
      SELECT *
      FROM tickets
      WHERE ${where.join(" AND ")}
      ORDER BY purchased_at DESC
      LIMIT 200
      `,
      params
    );

    return res.json({ tickets: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      operator,
      productType,
      productName,
      journeysIncluded,
      routeFrom,
      routeTo,
      amountCents,
      currency = "ZAR",
      validFrom,
      validUntil,
      paymentMethod,
      cardAlias,
      meta = {}
    } = req.body || {};

    if (!operator || !productType || !productName || !amountCents || !paymentMethod) {
      return res.status(400).json({ error: "Missing required ticket fields" });
    }

    const result = await query(
      `
      INSERT INTO tickets (
        id, user_id, operator, product_type, product_name,
        journeys_included, journeys_used,
        route_from, route_to,
        amount_cents, currency, status,
        purchased_at, valid_from, valid_until,
        payment_method, card_alias, meta
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, 0,
        $6, $7,
        $8, $9, 'PAID',
        NOW(), $10, $11,
        $12, $13, $14
      )
      RETURNING *
      `,
      [
        req.auth.userId,
        operator,
        productType,
        productName,
        journeysIncluded || null,
        routeFrom || null,
        routeTo || null,
        amountCents,
        currency,
        validFrom || null,
        validUntil || null,
        paymentMethod,
        cardAlias || null,
        JSON.stringify(meta)
      ]
    );

    return res.status(201).json({ ticket: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/use", requireAuth, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const ticketResult = await query(
      `
      SELECT *
      FROM tickets
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [ticketId, req.auth.userId]
    );

    if (!ticketResult.rows.length) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult.rows[0];
    if (ticket.status !== "PAID") {
      return res.status(400).json({ error: "Ticket is not active" });
    }

    const included = Number(ticket.journeys_included || 0);
    const used = Number(ticket.journeys_used || 0);

    let nextStatus = "PAID";
    let nextUsed = used;

    if (included > 0) {
      nextUsed = Math.min(included, used + 1);
      if (nextUsed >= included) nextStatus = "CANCELLED";
    }

    const updatedResult = await query(
      `
      UPDATE tickets
      SET journeys_used = $1, status = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [nextUsed, nextStatus, ticketId]
    );

    return res.json({ ticket: updatedResult.rows[0] });
  } catch (error) {
    return next(error);
  }
});

export default router;
