import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@localhost:5432/test";
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

const db = await import("../src/db.js");
const appModule = await import("../src/app.js");
const app = appModule.default;

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

afterEach(() => {
  db.__clearDbTestDoubles();
});

test("auth login returns 400 for missing credentials", async () => {
  db.__setDbTestDoubles({
    query: async () => ({ rows: [] }),
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    assert.equal(payload.error, "Email and password are required");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("wallet topup returns updated wallet for authenticated user", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "william@capeconnect.demo",
              full_name: "William User",
              role: "passenger",
              status: "ACTIVE",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const client = {
        query: async (sql) => {
          if (sql.includes("RETURNING *")) {
            return { rows: [{ user_id: "u-1", balance_cents: 12500, currency: "ZAR" }] };
          }
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/wallets/topup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({ amountCents: 2500, note: "test topup" }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.wallet.user_id, "u-1");
    assert.equal(payload.wallet.balance_cents, 12500);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin scope blocks operator_admin from accessing different operator", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "myciti-admin@capeconnect.demo",
              full_name: "MyCiTi Admin",
              role: "operator_admin",
              status: "ACTIVE",
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/bootstrap?operator=Golden%20Arrow", {
      method: "GET",
      headers: {
        Authorization: "Bearer admin-token",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(payload.error, "Operator scope violation");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
