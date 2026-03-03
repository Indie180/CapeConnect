import express from "express";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const operator = req.query.operator || null;
    const params = [];
    let where = "active = TRUE";

    if (operator) {
      params.push(operator);
      where += ` AND operator = $${params.length}`;
    }

    const result = await query(
      `
      SELECT r.*, fs.name AS from_stop_name, ts.name AS to_stop_name
      FROM routes r
      LEFT JOIN stops fs ON fs.id = r.from_stop_id
      LEFT JOIN stops ts ON ts.id = r.to_stop_id
      WHERE ${where}
      ORDER BY r.operator, r.route_code
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
    const operator = req.query.operator || null;
    const params = [];
    let sql = "SELECT * FROM stops";

    if (operator) {
      params.push(operator);
      sql += ` WHERE operator = $${params.length}`;
    }

    sql += " ORDER BY name";

    const result = await query(sql, params);
    return res.json({ stops: result.rows });
  } catch (error) {
    return next(error);
  }
});

export default router;
