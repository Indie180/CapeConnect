import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  useSqlite: process.env.USE_SQLITE === "true",
  databaseUrl: process.env.DATABASE_URL,
  frontendOrigins: String(process.env.FRONTEND_ORIGIN || "*")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS || 14)
};

if (!config.useSqlite && !config.databaseUrl) {
  throw new Error("DATABASE_URL is required when not using SQLite. Add it in backend/.env or set USE_SQLITE=true");
}
