import express from "express";
import { query } from "../db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const operator = req.query.operator || null;
    const params = [];

    let globalSql = "SELECT * FROM fare_products WHERE active = TRUE";
    if (operator) {
      params.push(operator);
      globalSql += ` AND operator = $${params.length}`;
    }
    globalSql += " ORDER BY operator, product_key";

    const globalResult = await query(globalSql, params);

    const routeParams = [];
    let routeSql = `
      SELECT rp.*, fs.name AS from_stop_name, ts.name AS to_stop_name
      FROM route_prices rp
      LEFT JOIN stops fs ON fs.id = rp.from_stop_id
      LEFT JOIN stops ts ON ts.id = rp.to_stop_id
    `;

    if (operator) {
      routeParams.push(operator);
      routeSql += ` WHERE rp.operator = $${routeParams.length}`;
    }
    routeSql += " ORDER BY rp.operator, from_stop_name, to_stop_name";

    const routeResult = await query(routeSql, routeParams);

    return res.json({
      globalProducts: globalResult.rows,
      routePrices: routeResult.rows
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
