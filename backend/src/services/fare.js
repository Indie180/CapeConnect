import { query } from "../db.js";

function normalizeOperator(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "myciti" || raw === "mc" || raw === "my-citi") return "MyCiTi";
  if (raw === "ga" || raw === "goldenarrow" || raw === "golden_arrow" || raw === "golden-arrow" || raw === "golden arrow") {
    return "Golden Arrow";
  }
  return String(value || "").trim();
}

function productMapKey(productType) {
  const cleaned = String(productType || "").trim().toLowerCase();
  if (["five_ride", "weekly", "monthly", "day1", "day3", "day7"].includes(cleaned)) {
    return cleaned;
  }
  return null;
}

export async function getFareProduct(operator, productType, productName) {
  const normalizedOperator = normalizeOperator(operator);
  if (!normalizedOperator) {
    return null;
  }

  const key = productMapKey(productType);
  if (key) {
    const result = await query(
      `
      SELECT *
      FROM fare_products
      WHERE lower(operator) = lower($1)
        AND lower(product_key) = lower($2)
        AND coalesce(active, TRUE) = TRUE
      LIMIT 1
      `,
      [normalizedOperator, key]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  if (productName) {
    const result = await query(
      `
      SELECT *
      FROM fare_products
      WHERE lower(operator) = lower($1)
        AND lower(label) = lower($2)
        AND coalesce(active, TRUE) = TRUE
      LIMIT 1
      `,
      [normalizedOperator, String(productName || "").trim()]
    );
    if (result.rows.length) {
      return result.rows[0];
    }
  }

  return null;
}

export async function getRoutePrice(operator, routeFrom, routeTo, productType) {
  const normalizedOperator = normalizeOperator(operator);
  const productKey = productMapKey(productType);
  if (!normalizedOperator || !routeFrom || !routeTo || !productKey) {
    return null;
  }

  const routePriceField = {
    five_ride: "five_ride_cents",
    weekly: "weekly_cents",
    monthly: "monthly_cents",
  }[productKey];

  if (!routePriceField) {
    return null;
  }

  const fromStop = await query(
    `
    SELECT id
    FROM stops
    WHERE lower(operator) = lower($1)
      AND lower(name) = lower($2)
    LIMIT 1
    `,
    [normalizedOperator, String(routeFrom || "").trim()]
  );

  const toStop = await query(
    `
    SELECT id
    FROM stops
    WHERE lower(operator) = lower($1)
      AND lower(name) = lower($2)
    LIMIT 1
    `,
    [normalizedOperator, String(routeTo || "").trim()]
  );

  if (!fromStop.rows.length || !toStop.rows.length) {
    return null;
  }

  const routePriceResult = await query(
    `
    SELECT ${routePriceField} AS price_cents
    FROM route_prices
    WHERE operator = $1
      AND from_stop_id = $2
      AND to_stop_id = $3
    LIMIT 1
    `,
    [normalizedOperator, fromStop.rows[0].id, toStop.rows[0].id]
  );

  if (!routePriceResult.rows.length) {
    return null;
  }

  const priceCents = Number(routePriceResult.rows[0].price_cents || 0);
  return Number.isFinite(priceCents) && priceCents > 0 ? priceCents : null;
}

export async function validateTicketFare({ operator, productType, productName, routeFrom, routeTo, amountCents }) {
  const requestedAmount = Number(amountCents);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error("Invalid amountCents value");
  }
  
  const normalizedOperator = normalizeOperator(operator);
  if (!normalizedOperator) {
    throw new Error("Invalid operator");
  }

  const normalizedProductType = String(productType || "").trim().toLowerCase();
  const normalizedProductName = String(productName || "").trim().toLowerCase();

  // MyCiTi Mover top-ups are variable-value stored-value loads rather than fixed fare products.
  if (
    normalizedOperator === "MyCiTi" &&
    (normalizedProductType === "topup" || normalizedProductType === "mover" || normalizedProductName.includes("top up"))
  ) {
    return true;
  }

  // Prefer route-specific pricing when available
  const routePrice = await getRoutePrice(normalizedOperator, routeFrom, routeTo, productType);
  if (routePrice !== null) {
    if (routePrice !== requestedAmount) {
      throw new Error(`Amount mismatch; expected ${routePrice} cents`);
    }
    return true;
  }

  const fareProduct = await getFareProduct(normalizedOperator, productType, productName);
  if (!fareProduct) {
    throw new Error("No matching fare product found");
  }

  if (Number(fareProduct.price_cents) !== requestedAmount) {
    throw new Error(`Amount mismatch; expected ${Number(fareProduct.price_cents)} cents`);
  }

  return true;
}
