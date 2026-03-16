import app from "./app.js";
import { config } from "./config.js";
import { initializeDatabase } from "./init-db.js";

async function start() {
  try {
    // Initialize database (SQLite only)
    await initializeDatabase();

    if (config.useSqlite) {
      console.log('✅ SQLite ready');
    } else {
      const { pool } = await import('./db.js');
      await pool.query("SELECT 1");
      console.log('✅ PostgreSQL connected');
    }

    app.listen(config.port, () => {
      console.log(`🚀 API running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

start();
