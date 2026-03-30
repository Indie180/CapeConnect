import express from "express";
import { query } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import qrCodeService from "../services/qrcode.js";
import { validateTicketFare } from "../services/fare.js";
import { log, serializeError } from "../utils/logger.js";

const router = express.Router();

function normalizeOperator(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "myciti") return "MyCiTi";
  if (raw === "ga" || raw === "goldenarrow" || raw === "golden_arrow" || raw === "golden-arrow" || raw === "golden arrow") {
    return "Golden Arrow";
  }
  return String(value || "").trim();
}

function normalizeTicketStatus(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "USED" || raw === "EXPIRED" || raw === "REFUNDED") return raw;
  if (raw === "CANCELLED") return "USED";
  return "PAID";
}

function inferExpiryDays(productType, productName, journeysIncluded) {
  const text = `${String(productType || "")} ${String(productName || "")}`.toLowerCase();
  if (text.includes("day3")) return 3;
  if (text.includes("day7") || text.includes("weekly")) return 7;
  if (text.includes("monthly")) return 30;
  if (text.includes("topup") || text.includes("mover")) return 365;
  if (Number(journeysIncluded || 0) > 1) return 30;
  return 7;
}

function normalizeValidUntil(validFrom, validUntil, productType, productName, journeysIncluded) {
  if (validUntil) return validUntil;
  const base = validFrom ? new Date(validFrom) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  const days = inferExpiryDays(productType, productName, journeysIncluded);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function deriveLifecycleStatus(ticket) {
  const currentStatus = normalizeTicketStatus(ticket?.status);
  if (currentStatus === "USED" || currentStatus === "EXPIRED" || currentStatus === "REFUNDED") {
    return currentStatus;
  }

  const validUntil = ticket?.valid_until ? new Date(ticket.valid_until) : null;
  if (validUntil && !Number.isNaN(validUntil.getTime()) && validUntil.getTime() <= Date.now()) {
    return "EXPIRED";
  }

  const included = Number(ticket?.journeys_included || 0);
  const used = Number(ticket?.journeys_used || 0);
  if (included > 0 && used >= included) {
    return "USED";
  }

  return "PAID";
}

async function reconcileTicketStatuses(userId) {
  await query(
    `
    UPDATE tickets
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE user_id = $1
      AND status = 'PAID'
      AND valid_until IS NOT NULL
      AND valid_until <= NOW()
    `,
    [userId]
  );

  await query(
    `
    UPDATE tickets
    SET status = 'USED', updated_at = NOW()
    WHERE user_id = $1
      AND status = 'PAID'
      AND journeys_included IS NOT NULL
      AND journeys_included > 0
      AND journeys_used >= journeys_included
    `,
    [userId]
  );
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const operator = normalizeOperator(req.query.operator || null);
    await reconcileTicketStatuses(req.auth.userId);
    const where = ["user_id = $1"];
    const params = [req.auth.userId];

    if (operator) {
      params.push(operator);
      where.push(`lower(operator) = lower($${params.length})`);
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

    const tickets = result.rows.map((ticket) => ({
      ...ticket,
      status: deriveLifecycleStatus(ticket),
    }));

    // Generate QR codes for active tickets
    const ticketsWithQR = await Promise.all(
      tickets.map(async (ticket) => {
        if (ticket.status === 'PAID') {
          try {
            const qrCode = await qrCodeService.generateTicketQR(ticket);
            return {
              ...ticket,
              qrCode: qrCode.qrCodeDataURL,
              qrCodeSVG: qrCode.qrCodeSVG
            };
          } catch (error) {
            log('error', 'QR generation failed for ticket', { ticketId: ticket.id, error: serializeError(error) });
            return ticket;
          }
        }
        return ticket;
      })
    );

    return res.json({ tickets: ticketsWithQR });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      operator: rawOperator,
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
      meta = {},
    } = req.body || {};

    const operator = normalizeOperator(rawOperator);

    if (!operator || !productType || !productName || !amountCents || !paymentMethod) {
      return res.status(400).json({ error: "Missing required ticket fields" });
    }

    try {
      await validateTicketFare({
        operator,
        productType,
        productName,
        routeFrom,
        routeTo,
        amountCents,
      });
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const normalizedValidFrom = validFrom || new Date().toISOString();
    const normalizedValidUntil = normalizeValidUntil(
      normalizedValidFrom,
      validUntil,
      productType,
      productName,
      journeysIncluded
    );

    const result = await query(
      `
      INSERT INTO tickets (
        id, user_id, operator, product_type, product_name,
        journeys_included, journeys_used,
        route_from, route_to,
        amount_cents, currency, status,
        purchased_at, valid_from, valid_until,
        payment_method, card_alias, meta, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, 0,
        $6, $7,
        $8, $9, 'PAID',
        NOW(), $10, $11,
        $12, $13, $14, NOW()
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
        normalizedValidFrom,
        normalizedValidUntil,
        paymentMethod,
        cardAlias || null,
        JSON.stringify(meta),
      ]
    );

    const createdTicket = {
      ...result.rows[0],
      status: deriveLifecycleStatus(result.rows[0]),
    };

    // Generate QR code for the new ticket
    try {
      const qrCode = await qrCodeService.generateTicketQR(createdTicket);
      createdTicket.qrCode = qrCode.qrCodeDataURL;
      createdTicket.qrCodeSVG = qrCode.qrCodeSVG;
    } catch (error) {
      log('error', 'QR generation failed for new ticket', { ticketId: createdTicket.id, error: serializeError(error) });
    }

    return res.status(201).json({ ticket: createdTicket });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/use", requireAuth, async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    await reconcileTicketStatuses(req.auth.userId);
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
    const lifecycleStatus = deriveLifecycleStatus(ticket);
    if (lifecycleStatus === "EXPIRED") {
      await query(
        `
        UPDATE tickets
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE id = $1
        `,
        [ticketId]
      );
      return res.status(400).json({ error: "Ticket has expired" });
    }
    if (lifecycleStatus !== "PAID") {
      return res.status(400).json({ error: "Ticket is not active" });
    }

    const included = Number(ticket.journeys_included || 0);
    const used = Number(ticket.journeys_used || 0);

    let nextStatus = "USED";
    let nextUsed = used;

    if (included > 0) {
      nextUsed = Math.min(included, used + 1);
      if (nextUsed < included) nextStatus = "PAID";
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

    return res.json({
      ticket: {
        ...updatedResult.rows[0],
        status: deriveLifecycleStatus(updatedResult.rows[0]),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// QR Code verification endpoint for conductors/validators
router.post("/verify-qr", requireAuth, requireRoles("user", "admin"), async (req, res, next) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ error: "QR data is required" });
    }

    let qrPayload;
    try {
      qrPayload = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({ error: "Invalid QR code format" });
    }

    // Verify QR code integrity
    if (!qrCodeService.verifyTicketQR(qrPayload)) {
      return res.status(400).json({ error: "Invalid or tampered QR code" });
    }

    // Get the actual ticket from database
    const ticketResult = await query(
      `
      SELECT *
      FROM tickets
      WHERE id = $1
      LIMIT 1
      `,
      [qrPayload.ticketId]
    );

    if (!ticketResult.rows.length) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult.rows[0];

    // Enforce user boundary: passengers can verify only their own tickets
    const currentRole = String(req.auth.role || "").toLowerCase();
    if (currentRole === "passenger" && ticket.user_id !== req.auth.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const currentStatus = deriveLifecycleStatus(ticket);

    // Check if ticket is valid for use
    const validationResult = {
      valid: false,
      ticket: {
        id: ticket.id,
        operator: ticket.operator,
        productName: ticket.product_name,
        routeFrom: ticket.route_from,
        routeTo: ticket.route_to,
        status: currentStatus,
        validFrom: ticket.valid_from,
        validUntil: ticket.valid_until,
        journeysIncluded: ticket.journeys_included,
        journeysUsed: ticket.journeys_used
      },
      message: ''
    };

    if (currentStatus === 'EXPIRED') {
      validationResult.message = 'Ticket has expired';
    } else if (currentStatus === 'USED') {
      validationResult.message = 'Ticket has been fully used';
    } else if (currentStatus === 'PAID') {
      validationResult.valid = true;
      validationResult.message = 'Valid ticket - ready for use';
    } else {
      validationResult.message = 'Ticket is not active';
    }

    return res.json(validationResult);

  } catch (error) {
    return next(error);
  }
});

// Get QR data for testing purposes
router.post("/get-qr-data", requireAuth, async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({ error: "Ticket ID is required" });
    }

    // Get the ticket
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
    const ticketWithStatus = {
      ...ticket,
      status: deriveLifecycleStatus(ticket)
    };

    // Generate QR code and return the raw data
    const qrCode = await qrCodeService.generateTicketQR(ticketWithStatus);
    
    return res.json({ qrData: qrCode.qrData });

  } catch (error) {
    return next(error);
  }
});

export default router;
