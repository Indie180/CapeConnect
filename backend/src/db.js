import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl
});

let testDoubles = null;

export async function query(text, params = []) {
  if (testDoubles?.query) {
    return testDoubles.query(text, params);
  }
  const result = await pool.query(text, params);
  return result;
}

export async function withTransaction(work) {
  if (testDoubles?.withTransaction) {
    return testDoubles.withTransaction(work);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback errors and rethrow original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function __setDbTestDoubles(doubles) {
  testDoubles = doubles || null;
}

export function __clearDbTestDoubles() {
  testDoubles = null;
}
