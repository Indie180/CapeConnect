import express from "express";
import crypto from "crypto";
import { query } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import qrCodeService from "../services/qrcode.js";
import { validateTicketFare } from "../services/fare.js";
import { log, logAlert, serializeError } from "../utils/logger.js";

const router = express.Router();
let qrValidationSchemaReady = null;

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

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

async function ensureQrValidationSchema() {
  if (qrValidationSchemaReady) return qrValidationSchemaReady;

  qrValidationSchemaReady = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS qr_validation_events (
        id TEXT PRIMARY KEY,
        ticket_id TEXT,
        validator_user_id TEXT NOT NULL,
        validator_role TEXT NOT NULL,
        validator_operator TEXT,
        ticket_operator TEXT,
        action TEXT NOT NULL,
        valid INTEGER NOT NULL DEFAULT 0,
        result_code TEXT NOT NULL,
        scan_source TEXT,
        device_id TEXT,
        location_json TEXT,
        scanned_at DATETIME NOT NULL DEFAULT (datetime('now')),
        created_at DATETIME NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_qr_validation_events_ticket_scanned
      ON qr_validation_events(ticket_id, scanned_at DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_qr_validation_events_validator_scanned
      ON qr_validation_events(validator_user_id, scanned_at DESC)
    `);
  })();

  return qrValidationSchemaReady;
}

async function recordQrValidationEvent({
  ticketId = null,
  validatorUserId,
  validatorRole,
  validatorOperator = null,
  ticketOperator = null,
  action,
  valid,
  resultCode,
  scanSource = null,
  deviceId = null,
  location = null,
}) {
  await ensureQrValidationSchema();
  await query(
    `
    INSERT INTO qr_validation_events (
      id, ticket_id, validator_user_id, validator_role, validator_operator,
      ticket_operator, action, valid, result_code, scan_source, device_id, location_json, scanned_at, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    `,
    [
      randomId(),
      ticketId,
      validatorUserId,
      validatorRole,
      validatorOperator,
      ticketOperator,
      action,
      valid ? 1 : 0,
      resultCode,
      scanSource,
      deviceId,
      location ? JSON.stringify(location) : null,
    ]
  );
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
      log("info", "ticket_create_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        reason: "missing_required_fields",
        operator,
        productType,
        productName,
      });
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
      log("info", "ticket_create_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        reason: "fare_validation_failed",
        operator,
        productType,
        productName,
        amountCents,
        error: serializeError(validationError),
      });
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

    log("info", "ticket_create_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
      ticketId: createdTicket.id,
      operator,
      productType,
      amountCents,
    });
    return res.status(201).json({ ticket: createdTicket });
  } catch (error) {
    log("error", "ticket_create_error", {
      requestId: req.requestId,
      userId: req.auth?.userId || null,
      error: serializeError(error),
    });
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
      log("info", "ticket_use_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId,
        reason: "ticket_not_found",
      });
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
      log("info", "ticket_use_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId,
        reason: "ticket_expired",
      });
      return res.status(400).json({ error: "Ticket has expired" });
    }
    if (lifecycleStatus !== "PAID") {
      log("info", "ticket_use_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId,
        reason: "ticket_not_active",
        status: lifecycleStatus,
      });
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

    log("info", "ticket_use_succeeded", {
      requestId: req.requestId,
      userId: req.auth.userId,
      ticketId,
      journeysUsed: nextUsed,
      status: nextStatus,
    });
    return res.json({
      ticket: {
        ...updatedResult.rows[0],
        status: deriveLifecycleStatus(updatedResult.rows[0]),
      },
    });
  } catch (error) {
    log("error", "ticket_use_error", {
      requestId: req.requestId,
      userId: req.auth?.userId || null,
      ticketId: req.params?.id || null,
      error: serializeError(error),
    });
    return next(error);
  }
});

// QR Code verification endpoint for conductors/validators
router.post("/verify-qr", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const { qrData, consume = false, scanSource = "manual", deviceId = null, location = null } = req.body || {};
    const validatorRole = String(req.auth.role || "").toLowerCase();
    const validatorOperator = normalizeOperator(req.auth.operator || null) || null;
    
    if (!qrData) {
      await recordQrValidationEvent({
        validatorUserId: req.auth.userId,
        validatorRole,
        validatorOperator,
        action: consume ? "consume" : "verify",
        valid: false,
        resultCode: "missing_qr_data",
        scanSource,
        deviceId,
        location,
      });
      log("info", "ticket_qr_verify_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        reason: "missing_qr_data",
      });
      return res.status(400).json({ error: "QR data is required" });
    }

    let qrPayload;
    try {
      qrPayload = JSON.parse(qrData);
    } catch {
      await recordQrValidationEvent({
        validatorUserId: req.auth.userId,
        validatorRole,
        validatorOperator,
        action: consume ? "consume" : "verify",
        valid: false,
        resultCode: "invalid_qr_format",
        scanSource,
        deviceId,
        location,
      });
      log("info", "ticket_qr_verify_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        reason: "invalid_qr_format",
      });
      return res.status(400).json({ error: "Invalid QR code format" });
    }

    // Verify QR code integrity
    if (!qrCodeService.verifyTicketQR(qrPayload)) {
      await recordQrValidationEvent({
        ticketId: qrPayload?.ticketId || null,
        validatorUserId: req.auth.userId,
        validatorRole,
        validatorOperator,
        ticketOperator: normalizeOperator(qrPayload?.operator || null) || null,
        action: consume ? "consume" : "verify",
        valid: false,
        resultCode: "invalid_qr_signature",
        scanSource,
        deviceId,
        location,
      });
      log("info", "ticket_qr_verify_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId: qrPayload?.ticketId || null,
        reason: "invalid_qr_signature",
      });
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
      await recordQrValidationEvent({
        ticketId: qrPayload.ticketId,
        validatorUserId: req.auth.userId,
        validatorRole,
        validatorOperator,
        ticketOperator: normalizeOperator(qrPayload?.operator || null) || null,
        action: consume ? "consume" : "verify",
        valid: false,
        resultCode: "ticket_not_found",
        scanSource,
        deviceId,
        location,
      });
      log("info", "ticket_qr_verify_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId: qrPayload.ticketId,
        reason: "ticket_not_found",
      });
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult.rows[0];
    const ticketOperator = normalizeOperator(ticket.operator || null) || null;

    if (validatorRole === "operator_admin" && validatorOperator && ticketOperator && validatorOperator !== ticketOperator) {
      await recordQrValidationEvent({
        ticketId: ticket.id,
        validatorUserId: req.auth.userId,
        validatorRole,
        validatorOperator,
        ticketOperator,
        action: consume ? "consume" : "verify",
        valid: false,
        resultCode: "operator_scope_violation",
        scanSource,
        deviceId,
        location,
      });
      log("info", "ticket_qr_verify_rejected", {
        requestId: req.requestId,
        userId: req.auth.userId,
        ticketId: ticket.id,
        reason: "operator_scope_violation",
      });
      return res.status(403).json({ error: "Operator scope violation" });
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
      message: '',
      action: consume ? 'consume' : 'verify'
    };

    if (currentStatus === 'EXPIRED') {
      validationResult.message = 'Ticket has expired';
    } else if (currentStatus === 'USED') {
      validationResult.message = 'Ticket has been fully used';
    } else if (currentStatus === 'PAID') {
      validationResult.valid = true;
      validationResult.message = consume ? 'Valid ticket - consumed for boarding' : 'Valid ticket - ready for use';
    } else {
      validationResult.message = 'Ticket is not active';
    }

    if (validationResult.valid && consume) {
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
        [nextUsed, nextStatus, ticket.id]
      );

      const updatedTicket = updatedResult.rows[0] || {
        ...ticket,
        journeys_used: nextUsed,
        status: nextStatus,
      };

      validationResult.ticket = {
        id: updatedTicket.id,
        operator: updatedTicket.operator,
        productName: updatedTicket.product_name,
        routeFrom: updatedTicket.route_from,
        routeTo: updatedTicket.route_to,
        status: deriveLifecycleStatus(updatedTicket),
        validFrom: updatedTicket.valid_from,
        validUntil: updatedTicket.valid_until,
        journeysIncluded: updatedTicket.journeys_included,
        journeysUsed: updatedTicket.journeys_used,
      };
      validationResult.consumed = true;
    } else {
      validationResult.consumed = false;
    }

    await recordQrValidationEvent({
      ticketId: ticket.id,
      validatorUserId: req.auth.userId,
      validatorRole,
      validatorOperator,
      ticketOperator,
      action: consume ? "consume" : "verify",
      valid: validationResult.valid,
      resultCode: validationResult.valid ? (consume ? "validated_and_consumed" : "validated") : String(currentStatus || "invalid").toLowerCase(),
      scanSource,
      deviceId,
      location,
    });

    log("info", "ticket_qr_verify_completed", {
      requestId: req.requestId,
      userId: req.auth.userId,
      ticketId: ticket.id,
      valid: validationResult.valid,
      status: currentStatus,
      consumed: validationResult.consumed,
    });
    return res.json(validationResult);

  } catch (error) {
    logAlert("ticket_qr_verify_error", {
      requestId: req.requestId,
      userId: req.auth?.userId || null,
      error: serializeError(error),
    }, {
      category: "tickets",
      severity: "high",
      code: "ticket_qr_verify_error",
    });
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
