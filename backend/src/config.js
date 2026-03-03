import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "*",
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES || 30),
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS || 14)
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it in backend/.env");
}
