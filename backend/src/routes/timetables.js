import express from "express";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const operator = req.query.operator || null;
    const routeId = req.query.routeId || null;
    const dayType = req.query.dayType || null;

    const params = [];
    const where = ["t.deleted = FALSE", "t.status = 'PUBLISHED'"];

    if (operator) {
      params.push(operator);
      where.push(`r.operator = $${params.length}`);
    }
    if (routeId) {
      params.push(routeId);
      where.push(`t.route_id = $${params.length}`);
    }
    if (dayType) {
      params.push(dayType);
      where.push(`t.day_type = $${params.length}`);
    }

    const result = await query(
      `
      SELECT t.*, r.route_name, r.route_code
      FROM timetables t
      JOIN routes r ON r.id = t.route_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.route_code, t.day_type, t.direction
      `,
      params
    );

    return res.json({ timetables: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;
