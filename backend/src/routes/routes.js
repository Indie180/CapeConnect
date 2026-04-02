import express from "express";
import { query } from "../db.js";

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

router.get("/", async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.query.operator || null);
    const params = [];
    let where = "coalesce(r.active, 1) = 1";

    if (operator) {
      params.push(operator);
      where += ` AND lower(r.operator) = lower($${params.length})`;
    }

    const result = await query(
      `
      SELECT
        r.*,
        coalesce(fs.name, r.origin) AS from_stop_name,
        coalesce(ts.name, r.destination) AS to_stop_name
      FROM routes r
      LEFT JOIN stops fs ON fs.id = r.from_stop_id
      LEFT JOIN stops ts ON ts.id = r.to_stop_id
      WHERE ${where}
      ORDER BY r.operator, coalesce(r.route_code, r.route_number), r.route_name
      `,
      params
    );

    return res.json({ routes: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get("/stops", async (req, res, next) => {
  try {
    const operator = normalizeOperator(req.query.operator || null);
    const params = [];
    let sql = `
      SELECT
        id,
        operator,
        coalesce(name, stop_name) AS name,
        code,
        coalesce(lat, latitude) AS lat,
        coalesce(lon, longitude) AS lon,
        created_at
      FROM stops
    `;

    if (operator) {
      params.push(operator);
      sql += ` WHERE lower(operator) = lower($${params.length})`;
    }

    sql += " ORDER BY coalesce(name, stop_name)";

    const result = await query(sql, params);
    return res.json({ stops: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;
