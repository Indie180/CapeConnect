import dotenv from "dotenv";
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  useSqlite: process.env.USE_SQLITE === "true",
  frontendOrigins: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",")
    : ["http://localhost:5173"],
  sessionTtlMinutes: parseInt(process.env.SESSION_TTL_MINUTES || "30", 10),
};
