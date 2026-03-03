import app from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";

async function start() {
  try {
    await pool.query("SELECT 1");
    app.listen(config.port, () => {
      console.log(`API running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
