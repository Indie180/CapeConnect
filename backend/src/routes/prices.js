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

    let globalSql = "SELECT * FROM fare_products WHERE coalesce(active, 1) = 1";
    if (operator) {
      params.push(operator);
      globalSql += ` AND lower(operator) = lower($${params.length})`;
    }
    globalSql += " ORDER BY operator, product_key";

    const globalResult = await query(globalSql, params);

    const routeParams = [];
    let routeSql = `
      SELECT
        rp.*,
        coalesce(fs.name, fs.stop_name) AS from_stop_name,
        coalesce(ts.name, ts.stop_name) AS to_stop_name
      FROM route_prices rp
      LEFT JOIN stops fs ON fs.id = rp.from_stop_id
      LEFT JOIN stops ts ON ts.id = rp.to_stop_id
    `;

    if (operator) {
      routeParams.push(operator);
      routeSql += ` WHERE lower(rp.operator) = lower($${routeParams.length})`;
    }
    routeSql += " ORDER BY rp.operator, from_stop_name, to_stop_name";

    const routeResult = await query(routeSql, routeParams);
    const routePrices = [];
    const productMap = [
      ["five_ride", "five_ride_cents"],
      ["weekly", "weekly_cents"],
      ["monthly", "monthly_cents"],
    ];

    (Array.isArray(routeResult.rows) ? routeResult.rows : []).forEach((row) => {
      productMap.forEach(([productKey, centsKey]) => {
        const priceCents = Number(row?.[centsKey] || 0);
        if (!Number.isFinite(priceCents) || priceCents <= 0) return;
        routePrices.push({
          id: row.id,
          operator: row.operator,
          from_stop_id: row.from_stop_id,
          to_stop_id: row.to_stop_id,
          from_stop_name: row.from_stop_name,
          to_stop_name: row.to_stop_name,
          product_key: productKey,
          price_cents: priceCents,
        });
      });
    });

    return res.json({
      globalProducts: globalResult.rows,
      routePrices,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
