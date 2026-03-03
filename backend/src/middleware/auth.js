import crypto from "crypto";
import { query } from "../db.js";

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
      SELECT s.user_id, s.expires_at, u.email, u.full_name, u.role, u.status
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

    req.auth = {
      userId: session.user_id,
      email: session.email,
      fullName: session.full_name,
      role: session.role,
      status: session.status,
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

function operatorFromAdminEmail(email) {
  const e = String(email || "").toLowerCase();
  if (e.includes("ga-admin")) return "Golden Arrow";
  if (e.includes("myciti-admin")) return "MyCiTi";
  return "";
}

export function requireAdminOperatorScope(resolveOperator) {
  return (req, res, next) => {
    const requestedOperator = String(resolveOperator(req) || "").trim();
    if (!requestedOperator) {
      return res.status(400).json({ error: "operator is required" });
    }

    const role = String(req?.auth?.role || "").toLowerCase();
    if (role === "super_admin") return next();

    const adminOperator = operatorFromAdminEmail(req?.auth?.email);
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
  "admin-ga": ["operator_admin", "super_admin"],
  "admin-myciti": ["operator_admin", "super_admin"],
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
