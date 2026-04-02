import app from "./app.js";
import { config } from "./config.js";
import { initializeDatabase } from "./init-db.js";
import { log, serializeError } from "./utils/logger.js";

process.on("unhandledRejection", (error) => {
  log("error", "unhandled_rejection", { error: serializeError(error) });
});

process.on("uncaughtException", (error) => {
  log("error", "uncaught_exception", { error: serializeError(error) });
  process.exit(1);
});

async function start() {
  try {
    await initializeDatabase();

    if (config.useSqlite) {
      log("info", "database_ready", { database: "sqlite" });
    } else {
      const { pool } = await import("./db.js");
      await pool.query("SELECT 1");
      log("info", "database_ready", { database: "postgres" });
    }

    app.listen(config.port, () => {
      log("info", "server_started", {
        env: config.env,
        port: config.port,
        database: config.useSqlite ? "sqlite" : "postgres",
      });
    });
  } catch (error) {
    log("error", "server_start_failed", { error: serializeError(error) });
    process.exit(1);
  }
}

start();
