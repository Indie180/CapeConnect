import crypto from "crypto";
import { query } from "../db.js";
import { config } from "../config.js";

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const tokenHash = hashToken(token);

    const sessionResult = await query(
      `
      SELECT s.user_id, s.expires_at, u.email, u.full_name, u.phone, u.role, u.status, u.operator
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const session = sessionResult.rows[0];
    const expiresAt = new Date(session.expires_at).getTime();

    if (expiresAt <= Date.now()) {
      return res.status(401).json({ error: "Session expired" });
    }
    if (String(session.status || "").toUpperCase() !== "ACTIVE") {
      return res.status(403).json({ error: "User is not active" });
    }

    // Update session activity (SQLite compatible)
    if (config.useSqlite) {
      await query(
        'UPDATE sessions SET last_activity = datetime(\'now\') WHERE token_hash = $1',
        [tokenHash]
      );
    } else {
      await query(
        'UPDATE sessions SET last_activity = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
    }

    req.auth = {
      userId: session.user_id,
      email: session.email,
      fullName: session.full_name,
      phone: session.phone || "",
      role: session.role,
      status: session.status,
      operator: session.operator || null,
      tokenHash
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.auth || (req.auth.role !== "operator_admin" && req.auth.role !== "super_admin")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

function normalizeOperator(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "myciti") return "MyCiTi";
  if (raw === "ga" || raw === "goldenarrow" || raw === "golden_arrow" || raw === "golden-arrow" || raw === "golden arrow") {
    return "Golden Arrow";
  }
  return String(value || "").trim();
}

export function requireAdminOperatorScope(resolveOperator) {
  return (req, res, next) => {
    const requestedOperator = normalizeOperator(resolveOperator(req));
    if (!requestedOperator) {
      return res.status(400).json({ error: "operator is required" });
    }

    const role = String(req?.auth?.role || "").toLowerCase();
    if (role === "super_admin") return next();

    const adminOperator = normalizeOperator(req?.auth?.operator);
    if (!adminOperator) {
      return res.status(403).json({ error: "Admin operator scope not recognized" });
    }

    if (requestedOperator !== adminOperator) {
      return res.status(403).json({ error: "Operator scope violation" });
    }

    req.adminOperator = adminOperator;
    return next();
  };
}

const roleAliasMap = {
  user: ["passenger"],
  admin: ["operator_admin", "super_admin"],
  super_admin: ["super_admin"],
  operator_admin: ["operator_admin", "super_admin"],
};

export function requireRoles(...roleAliases) {
  const allowed = new Set(
    roleAliases
      .flatMap((r) => roleAliasMap[String(r || "").toLowerCase()] || [String(r || "").toLowerCase()])
      .filter(Boolean)
  );

  return (req, res, next) => {
    const role = String(req?.auth?.role || "").toLowerCase();
    if (!role || !allowed.has(role)) {
      return res.status(403).json({ error: "Insufficient role for this resource" });
    }
    return next();
  };
}

export function getTokenHash(rawToken) {
  return hashToken(rawToken);
}
