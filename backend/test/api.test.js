import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import qrcodeService from "../src/services/qrcode.js";
import payfast from "../src/services/payfast.js";

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

async function requestText(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.text();
  return { response, payload };
}

const originalPayfastFns = {
  verifyWebhook: payfast.verifyWebhook.bind(payfast),
  validatePayment: payfast.validatePayment.bind(payfast),
  getPaymentStatus: payfast.getPaymentStatus.bind(payfast),
};

afterEach(() => {
  db.__clearDbTestDoubles();
  payfast.verifyWebhook = originalPayfastFns.verifyWebhook;
  payfast.validatePayment = originalPayfastFns.validatePayment;
  payfast.getPaymentStatus = originalPayfastFns.getPaymentStatus;
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
    assert.equal(payload.error, "Validation failed");
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

test("wallet topup rejects invalid amountCents payload", async () => {
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
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/wallets/topup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({ amountCents: -5 }),
    });
    assert.equal(response.status, 400);
    assert.equal(payload.error, "Validation failed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("verify-qr endpoint requires authentication", async () => {
  db.__setDbTestDoubles({
    query: async () => ({ rows: [] }),
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets/verify-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrData: JSON.stringify({ ticketId: "t-1" }) }),
    });

    assert.equal(response.status, 401);
    assert.equal(payload.error, "Missing bearer token");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("passenger cannot access verify-qr validator endpoint", async () => {
  const qrPayload = {
    ticketId: "t-2",
    userId: "different-user",
    operator: "MyCiTi",
    productName: "Route Pass",
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    journeysIncluded: 1,
    journeysUsed: 0,
    status: "PAID",
    timestamp: Date.now(),
  };
  qrPayload.hash = qrcodeService.createVerificationHash(qrPayload);

  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "passenger@capeconnect.demo",
              full_name: "Passenger",
              role: "passenger",
              status: "ACTIVE",
            },
          ],
        };
      }

      if (sql.includes("FROM tickets")) {
        return {
          rows: [
            {
              id: "t-2",
              user_id: "different-user",
              operator: "MyCiTi",
              product_name: "Route Pass",
              journeys_included: 1,
              journeys_used: 0,
              amount_cents: 1000,
              currency: "ZAR",
              status: "PAID",
              valid_from: qrPayload.validFrom,
              valid_until: qrPayload.validUntil,
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets/verify-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({ qrData: JSON.stringify(qrPayload) }),
    });

    assert.equal(response.status, 403);
    assert.equal(payload.error, "Insufficient role for this resource");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("operator_admin can verify another user ticket via verify-qr", async () => {
  const qrPayload = {
    ticketId: "t-3",
    userId: "different-user",
    operator: "MyCiTi",
    productName: "Route Pass",
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    journeysIncluded: 1,
    journeysUsed: 0,
    status: "PAID",
    timestamp: Date.now(),
  };
  qrPayload.hash = qrcodeService.createVerificationHash(qrPayload);

  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "admin@capeconnect.demo",
              full_name: "Operator Admin",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }

      if (sql.includes("FROM tickets")) {
        return {
          rows: [
            {
              id: "t-3",
              user_id: "different-user",
              operator: "MyCiTi",
              product_name: "Route Pass",
              journeys_included: 1,
              journeys_used: 0,
              amount_cents: 1000,
              currency: "ZAR",
              status: "PAID",
              valid_from: qrPayload.validFrom,
              valid_until: qrPayload.validUntil,
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets/verify-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({ qrData: JSON.stringify(qrPayload) }),
    });

    assert.equal(response.status, 200);
    assert.equal(payload.valid, true);
    assert.equal(payload.ticket.id, "t-3");
    assert.equal(payload.consumed, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("operator_admin cannot verify ticket outside operator scope", async () => {
  const qrPayload = {
    ticketId: "t-4",
    userId: "different-user",
    operator: "Golden Arrow",
    productName: "Route Pass",
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    journeysIncluded: 1,
    journeysUsed: 0,
    status: "PAID",
    timestamp: Date.now(),
  };
  qrPayload.hash = qrcodeService.createVerificationHash(qrPayload);

  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "admin@capeconnect.demo",
              full_name: "Operator Admin",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }

      if (sql.includes("FROM tickets")) {
        return {
          rows: [
            {
              id: "t-4",
              user_id: "different-user",
              operator: "Golden Arrow",
              product_name: "Route Pass",
              journeys_included: 1,
              journeys_used: 0,
              amount_cents: 1000,
              currency: "ZAR",
              status: "PAID",
              valid_from: qrPayload.validFrom,
              valid_until: qrPayload.validUntil,
            },
          ],
        };
      }

      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets/verify-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({ qrData: JSON.stringify(qrPayload) }),
    });

    assert.equal(response.status, 403);
    assert.equal(payload.error, "Operator scope violation");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("ticket creation validates fare product against fare_products", async () => {
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
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
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("FROM fare_products")) {
        return {
          rows: [
            {
              id: "f-1",
              operator: "MyCiTi",
              product_key: "day1",
              label: "1 Day Pass",
              journeys: null,
              price_cents: 9000,
              active: true,
            },
          ],
        };
      }
      if (sql.includes("INSERT INTO tickets")) {
        return {
          rows: [
            {
              id: "t-9",
              user_id: "u-1",
              operator: "MyCiTi",
              product_type: "day1",
              product_name: "1 Day Pass",
              journeys_included: null,
              journeys_used: 0,
              route_from: null,
              route_to: null,
              amount_cents: 9000,
              currency: "ZAR",
              status: "PAID",
              purchased_at: new Date().toISOString(),
              valid_from: new Date().toISOString(),
              valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              payment_method: "CARD",
              card_alias: null,
              meta: {},
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({
        operator: "MyCiTi",
        productType: "day1",
        productName: "1 Day Pass",
        amountCents: 9000,
        paymentMethod: "CARD",
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(payload.ticket.id, "t-9");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("ticket creation rejects incorrect fare amount", async () => {
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
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
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("FROM fare_products")) {
        return {
          rows: [
            {
              id: "f-1",
              operator: "MyCiTi",
              product_key: "day1",
              label: "1 Day Pass",
              journeys: null,
              price_cents: 9000,
              active: true,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({
        operator: "MyCiTi",
        productType: "day1",
        productName: "1 Day Pass",
        amountCents: 10000,
        paymentMethod: "CARD",
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(payload.error, "Amount mismatch; expected 9000 cents");
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
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "MyCiTi",
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

test("admin scope rejects operator_admin without authenticated operator", async () => {
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
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/bootstrap?operator=MyCiTi", {
      method: "GET",
      headers: {
        Authorization: "Bearer admin-token",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(payload.error, "Admin operator scope not recognized");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("profile update persists bank details through /api/auth/me", async () => {
  const queries = [];
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "0821110001",
              role: "passenger",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("PRAGMA table_info(users)")) {
        return {
          rows: [
            { name: "id" },
            { name: "email" },
            { name: "full_name" },
            { name: "phone" },
            { name: "operator" },
          ],
        };
      }
      if (sql.includes("SELECT service_key")) {
        return { rows: [{ service_key: "myciti" }] };
      }
      if (sql.includes("UPDATE users")) {
        return {
          rows: [
            {
              id: "u-1",
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "0821110002",
              role: "passenger",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("INSERT INTO user_banking_profiles")) {
        return { rows: [] };
      }
      if (sql.includes("FROM user_banking_profiles")) {
        return {
          rows: [
            {
              bank_name: "FNB",
              branch_name: "Cape Town",
              branch_code: "250655",
              country: "South Africa",
              account_number: "1234567890",
              account_type: "savings",
              currency: "ZAR",
              account_holder_confirmed: 1,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({
        phone: "0821110002",
        bankDetails: {
          bankName: "FNB",
          branchName: "Cape Town",
          branchCode: "250655",
          country: "South Africa",
          accountNumber: "1234567890",
          accountType: "savings",
          currency: "ZAR",
          accountHolderConfirmed: true,
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.user.phone, "0821110002");
    assert.equal(payload.user.bankDetails.bankName, "FNB");
    assert.equal(payload.user.bankDetails.accountHolderConfirmed, true);
    assert.equal(
      queries.some(({ sql }) => sql.includes("INSERT INTO user_banking_profiles")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("change password rejects wrong current password", async () => {
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
              phone: "0821110001",
              role: "passenger",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("SELECT id, password_hash")) {
        return {
          rows: [
            {
              id: "u-1",
              password_hash: "$2a$10$KIXQ4j0s3Q0mG0xvYDn8LefN0jR0wA0WIMRqjYOEoTP0TOZcdLX7K",
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({
        currentPassword: "Wrong#123",
        newPassword: "NewDemo#123",
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(payload.error, "Current password is incorrect");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin scope uses authenticated operator instead of email naming", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      if (sql.includes("SELECT DISTINCT u.id")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT id, user_id, operator")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT w.user_id")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT wt.*")) {
        return { rows: [] };
      }
      if (sql.includes("FROM fare_products")) {
        return { rows: [] };
      }
      if (sql.includes("FROM route_prices")) {
        return { rows: [] };
      }
      if (sql.includes("FROM timetables")) {
        return { rows: [] };
      }
      if (sql.includes("FROM audit_logs")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response } = await requestJson(baseUrl, "/api/admin/bootstrap?operator=Golden%20Arrow", {
      method: "GET",
      headers: {
        Authorization: "Bearer admin-token",
      },
    });
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin users bulk rejects malformed payload", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/users/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        users: [{ id: "bad-id", fullName: "", email: "not-an-email" }],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(payload.error, "Validation failed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin tickets bulk rewrites scoped tickets for the operator", async () => {
  const statements = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const client = {
        query: async (sql, params = []) => {
          statements.push({ sql, params });
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/tickets/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        tickets: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            userId: "22222222-2222-4222-8222-222222222222",
            productType: "weekly",
            productName: "Weekly Ticket",
            journeysIncluded: 10,
            journeysUsed: 0,
            routeFrom: "Cape Town",
            routeTo: "Langa",
            amount: 234,
            currency: "ZAR",
            status: "PAID",
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("DELETE FROM tickets WHERE operator = $1") && params[0] === "Golden Arrow"), true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO tickets") && params[2] === "Golden Arrow" && params[9] === 23400), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin wallets bulk only updates users in the scoped operator", async () => {
  const statements = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const client = {
        query: async (sql, params = []) => {
          statements.push({ sql, params });
          if (sql.includes("SELECT 1") && params[0] === "22222222-2222-4222-8222-222222222222") {
            return { rows: [{ "?column?": 1 }] };
          }
          if (sql.includes("SELECT 1")) {
            return { rows: [] };
          }
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/wallets/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        wallets: [
          {
            userId: "22222222-2222-4222-8222-222222222222",
            balance: 150.5,
            currency: "ZAR",
            transactions: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                type: "TOPUP",
                amount: 150.5,
                note: "Scoped load",
              },
            ],
          },
          {
            userId: "44444444-4444-4444-8444-444444444444",
            balance: 99,
            currency: "ZAR",
            transactions: [],
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO wallets") && params[0] === "22222222-2222-4222-8222-222222222222" && params[1] === 15050), true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO wallets") && params[0] === "44444444-4444-4444-8444-444444444444"), false);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO wallet_transactions") && params[1] === "22222222-2222-4222-8222-222222222222" && params[3] === 15050), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin global prices bulk upserts scoped fare products", async () => {
  const statements = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const client = {
        query: async (sql, params = []) => {
          statements.push({ sql, params });
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/prices/global/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        pricesGlobal: [
          { key: "weekly", label: "Weekly Ticket", journeys: 10, price: 234 },
        ],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO fare_products") && params[0] === "Golden Arrow" && params[1] === "weekly" && params[4] === 23400), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin route prices bulk rewrites scoped route fares", async () => {
  const statements = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const stopIds = new Map();
      let stopSeq = 1;
      const client = {
        query: async (sql, params = []) => {
          statements.push({ sql, params });
          if (sql.includes("SELECT id") && sql.includes("FROM stops")) {
            const key = `${params[0]}::${params[1]}`;
            const id = stopIds.get(key);
            return { rows: id ? [{ id }] : [] };
          }
          if (sql.includes("INSERT INTO stops")) {
            const key = `${params[0]}::${params[1]}`;
            const id = `stop-${stopSeq++}`;
            stopIds.set(key, id);
            return { rows: [{ id }] };
          }
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/prices/routes/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        pricesRoutes: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            from: "Cape Town",
            to: "Langa",
            five_ride: 126.5,
            weekly: 234,
            monthly: 1030,
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("DELETE FROM route_prices WHERE operator = $1") && params[0] === "Golden Arrow"), true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO route_prices") && params[1] === "Golden Arrow" && params[4] === 12650 && params[5] === 23400 && params[6] === 103000), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin timetables bulk rewrites scoped timetable entries", async () => {
  const statements = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
    withTransaction: async (work) => {
      const stopIds = new Map();
      const routeIds = new Map();
      let stopSeq = 1;
      let routeSeq = 1;
      const client = {
        query: async (sql, params = []) => {
          statements.push({ sql, params });
          if (sql.includes("SELECT id") && sql.includes("FROM routes") && sql.includes("route_code")) {
            const key = `${params[0]}::code::${params[1]}`;
            const id = routeIds.get(key);
            return { rows: id ? [{ id }] : [] };
          }
          if (sql.includes("SELECT id") && sql.includes("FROM routes") && sql.includes("route_name")) {
            const key = `${params[0]}::name::${params[1]}`;
            const id = routeIds.get(key);
            return { rows: id ? [{ id }] : [] };
          }
          if (sql.includes("SELECT id") && sql.includes("FROM stops")) {
            const key = `${params[0]}::${params[1]}`;
            const id = stopIds.get(key);
            return { rows: id ? [{ id }] : [] };
          }
          if (sql.includes("INSERT INTO stops")) {
            const key = `${params[0]}::${params[1]}`;
            const id = `stop-${stopSeq++}`;
            stopIds.set(key, id);
            return { rows: [{ id }] };
          }
          if (sql.includes("INSERT INTO routes")) {
            const codeKey = `${params[0]}::code::${params[1]}`;
            const nameKey = `${params[0]}::name::${params[2]}`;
            const id = `route-${routeSeq++}`;
            routeIds.set(codeKey, id);
            routeIds.set(nameKey, id);
            return { rows: [{ id }] };
          }
          return { rows: [] };
        },
      };
      return work(client);
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/timetables/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        timetables: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            routeName: "Cape Town Express",
            routeCode: "CTE-1",
            direction: "Outbound",
            dayType: "Weekday",
            stops: [{ name: "Cape Town" }, { name: "Langa" }],
            times: ["06:00", "06:30"],
            status: "PUBLISHED",
            effectiveFrom: "2026-03-17T00:00:00.000Z",
            deleted: false,
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("DELETE FROM timetables") && params[0] === "Golden Arrow"), true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO routes") && params[0] === "Golden Arrow" && params[1] === "CTE-1"), true);
    assert.equal(statements.some(({ sql, params }) => sql.includes("INSERT INTO timetables") && params[1] === "route-1" && params[2] === "Outbound" && params[6] === "PUBLISHED"), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin audit write ignores caller supplied adminEmail", async () => {
  const queries = [];
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "admin-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "ops-admin@capeconnect.demo",
              full_name: "Golden Arrow Admin",
              phone: "",
              role: "operator_admin",
              status: "ACTIVE",
              operator: "Golden Arrow",
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/admin/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
      body: JSON.stringify({
        operator: "Golden Arrow",
        entry: {
          adminEmail: "spoofed@example.com",
          action: "ADMIN_ACTION",
          targetType: "CONFIG",
          targetId: "cfg-1",
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    const insertCall = queries.find(({ sql }) => sql.includes("INSERT INTO audit_logs"));
    assert.ok(insertCall);
    assert.equal(insertCall.params[3], "ops-admin@capeconnect.demo");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("ticket use marks a single-use ticket as USED", async () => {
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "0821110001",
              role: "passenger",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("UPDATE tickets") && sql.includes("SET status = 'EXPIRED'")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE tickets") && sql.includes("SET status = 'USED'") && sql.includes("journeys_included")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT *") && sql.includes("FROM tickets")) {
        return {
          rows: [
            {
              id: params[0],
              user_id: "u-1",
              operator: "MyCiTi",
              product_type: "single",
              product_name: "Single Trip",
              journeys_included: null,
              journeys_used: 0,
              route_from: "Civic Centre",
              route_to: "Table View",
              amount_cents: 1850,
              currency: "ZAR",
              status: "PAID",
              purchased_at: new Date().toISOString(),
              valid_from: new Date().toISOString(),
              valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };
      }
      if (sql.includes("UPDATE tickets") && sql.includes("RETURNING *")) {
        return {
          rows: [
            {
              id: params[2],
              user_id: "u-1",
              operator: "MyCiTi",
              product_type: "single",
              product_name: "Single Trip",
              journeys_included: null,
              journeys_used: 0,
              route_from: "Civic Centre",
              route_to: "Table View",
              amount_cents: 1850,
              currency: "ZAR",
              status: params[1],
              purchased_at: new Date().toISOString(),
              valid_from: new Date().toISOString(),
              valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets/t-1/use", {
      method: "POST",
      headers: {
        Authorization: "Bearer fake-token",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ticket.status, "USED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("ticket list reconciles expired tickets before returning history", async () => {
  const queries = [];
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      queries.push(sql);
      if (sql.includes("FROM sessions s")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "0821110001",
              role: "passenger",
              status: "ACTIVE",
              operator: "MyCiTi",
            },
          ],
        };
      }
      if (sql.includes("SELECT *") && sql.includes("FROM tickets")) {
        return {
          rows: [
            {
              id: "t-expired",
              user_id: "u-1",
              operator: "MyCiTi",
              product_type: "single",
              product_name: "Single Trip",
              journeys_included: null,
              journeys_used: 0,
              route_from: "Civic Centre",
              route_to: "Table View",
              amount_cents: 1850,
              currency: "ZAR",
              status: "EXPIRED",
              purchased_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              valid_from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              valid_until: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/tickets", {
      method: "GET",
      headers: {
        Authorization: "Bearer fake-token",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.tickets[0].status, "EXPIRED");
    assert.equal(
      queries.some((sql) => sql.includes("SET status = 'EXPIRED'")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("forgot password returns a reset token in non-production flows", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("PRAGMA table_info(users)")) {
        return { rows: [{ name: "id" }, { name: "operator" }, { name: "phone" }] };
      }
      if (sql.includes("SELECT id, email, status")) {
        return {
          rows: [
            {
              id: "u-1",
              email: "william@capeconnect.demo",
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
    const { response, payload } = await requestJson(baseUrl, "/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "william@capeconnect.demo",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.resetToken, "string");
    assert.equal(String(payload.resetUrl || "").includes("/reset-password.html?token="), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("reset password updates the password and revokes sessions", async () => {
  const seen = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      seen.push(sql);
      if (sql.includes("SELECT prt.user_id")) {
        return {
          rows: [
            {
              user_id: "u-1",
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              used_at: null,
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
    const { response, payload } = await requestJson(baseUrl, "/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: "demo-reset-token",
        newPassword: "NewDemo#123",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(seen.some((sql) => sql.includes("UPDATE users") && sql.includes("password_hash")), true);
    assert.equal(seen.some((sql) => sql.includes("DELETE FROM sessions")), true);
    assert.equal(seen.some((sql) => sql.includes("UPDATE refresh_sessions")), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("payfast webhook rejects callbacks that fail provider validation", async () => {
  const statements = [];
  payfast.verifyWebhook = () => true;
  payfast.validatePayment = async () => false;

  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      statements.push({ sql, params });
      if (sql.includes("INSERT INTO payment_webhooks")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE payment_webhooks")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestText(baseUrl, "/api/payments/payfast/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: "valid-signature",
        m_payment_id: "CC_payment-1_123",
        payment_status: "COMPLETE",
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(payload, "Validation failed");
    assert.equal(
      statements.some(({ sql, params }) => sql.includes("UPDATE payment_webhooks") && String(params[0]).includes("PayFast server validation failed")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("payfast webhook is idempotent for already completed payments", async () => {
  const statements = [];
  payfast.verifyWebhook = () => true;
  payfast.validatePayment = async () => true;
  payfast.getPaymentStatus = () => "COMPLETED";

  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      statements.push({ sql, params });
      if (sql.includes("INSERT INTO payment_webhooks")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE payment_webhooks") && sql.includes("SET signature_valid")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT * FROM payments")) {
        return {
          rows: [
            {
              id: "payment-1",
              user_id: "u-1",
              amount_cents: 5000,
              status: "COMPLETED",
              payfast_payment_id: "CC_payment-1_123",
            },
          ],
        };
      }
      if (sql.includes("UPDATE payment_webhooks") && sql.includes("SET processed = 1")) {
        return { rows: [] };
      }
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestText(baseUrl, "/api/payments/payfast/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: "valid-signature",
        payment_status: "COMPLETE",
        m_payment_id: "CC_payment-1_123",
        amount_gross: "50.00",
        custom_str1: "u-1",
        custom_str3: "payment-1",
        pf_payment_id: "pf-123",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(payload, "OK");
    assert.equal(
      statements.some(({ sql }) => sql.includes("SELECT balance_cents FROM wallets")),
      false
    );
    assert.equal(
      statements.some(({ sql }) => sql.includes("INSERT INTO wallet_transactions")),
      false
    );
    assert.equal(
      statements.some(({ sql }) => sql.includes("UPDATE payment_webhooks") && sql.includes("SET processed = 1")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("health endpoint returns ok", async () => {
  db.__setDbTestDoubles({ query: async () => ({ rows: [] }) });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/health");
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "capeconnect-backend");
    assert.equal(typeof payload.time, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readyz endpoint returns ok", async () => {
  db.__setDbTestDoubles({ query: async () => ({ rows: [] }) });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/readyz");
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, "capeconnect-backend");
    assert.equal(typeof payload.database, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unauthenticated request to protected route returns 401", async () => {
  db.__setDbTestDoubles({ query: async () => ({ rows: [] }) });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/wallets/me");
    assert.equal(response.status, 401);
    assert.equal(typeof payload.error, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth login returns 423 when account is locked", async () => {
  const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("failed_attempts") && sql.includes("locked_until")) {
        return {
          rows: [{ failed_attempts: 5, locked_until: lockedUntil }],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "locked@capeconnect.demo", password: "AnyPass#1" }),
    });
    assert.equal(response.status, 423);
    assert.equal(typeof payload.error, "string");
    assert.equal(typeof payload.lockedUntil, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth login returns 401 for wrong password and increments failed_attempts", async () => {
  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("CorrectPass#1", 10);
  const seen = [];

  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      seen.push({ sql, params });
      // checkAccountLockout lookup
      if (sql.includes("failed_attempts") && sql.includes("locked_until")) {
        return { rows: [{ failed_attempts: 0, locked_until: null }] };
      }
      // user lookup during login
      if (sql.includes("SELECT id") && sql.includes("FROM users")) {
        return {
          rows: [
            {
              id: "u-1",
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "",
              role: "passenger",
              status: "ACTIVE",
              password_hash: passwordHash,
              operator: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response } = await requestJson(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "william@capeconnect.demo", password: "WrongPass#1" }),
    });
    assert.equal(response.status, 401);
    // handleFailedLogin must issue an UPDATE to increment failed_attempts
    assert.equal(
      seen.some(({ sql }) => sql.includes("failed_attempts") && sql.includes("UPDATE users")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth register creates a new user and returns tokens", async () => {
  const seen = [];
  db.__setDbTestDoubles({
    query: async (sql, params = []) => {
      seen.push({ sql, params });
      // existing user check — none found
      if (sql.includes("SELECT id") && sql.includes("FROM users")) {
        return { rows: [] };
      }
      // user_services lookup
      if (sql.includes("FROM user_services")) {
        return { rows: [] };
      }
      // banking profile lookup
      if (sql.includes("FROM user_banking_profiles")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "New User",
        email: "newuser@capeconnect.demo",
        password: "StrongPass#1",
        phone: "0821234567",
      }),
    });
    assert.equal(response.status, 201);
    assert.equal(typeof payload.token, "string");
    assert.equal(typeof payload.refreshToken, "string");
    assert.equal(payload.user.email, "newuser@capeconnect.demo");
    assert.equal(
      seen.some(({ sql }) => sql.includes("INSERT INTO users")),
      true
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth register returns 409 when email already exists", async () => {
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("SELECT id") && sql.includes("FROM users")) {
        return { rows: [{ id: "u-existing" }] };
      }
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Duplicate User",
        email: "existing@capeconnect.demo",
        password: "StrongPass#1",
        phone: "0821234567",
      }),
    });
    assert.equal(response.status, 409);
    assert.equal(typeof payload.error, "string");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth refresh returns new access token", async () => {
  const refreshToken = "a".repeat(64);
  db.__setDbTestDoubles({
    query: async (sql) => {
      if (sql.includes("FROM refresh_sessions rs")) {
        return {
          rows: [
            {
              user_id: "u-1",
              token_hash: "any",
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              revoked_at: null,
              email: "william@capeconnect.demo",
              full_name: "William User",
              phone: "",
              role: "passenger",
              status: "ACTIVE",
              operator: null,
            },
          ],
        };
      }
      if (sql.includes("FROM user_services")) return { rows: [] };
      if (sql.includes("FROM user_banking_profiles")) return { rows: [] };
      return { rows: [] };
    },
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    assert.equal(response.status, 200);
    assert.equal(typeof payload.token, "string");
    assert.equal(typeof payload.refreshToken, "string");
    assert.equal(payload.user.email, "william@capeconnect.demo");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth logout deletes session for authenticated user", async () => {
  const seen = [];
  db.__setDbTestDoubles({
    query: async (sql) => {
      seen.push(sql);
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
  });

  const { server, baseUrl } = await startServer();
  try {
    const { response, payload } = await requestJson(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(seen.some((sql) => sql.includes("DELETE FROM sessions")), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
