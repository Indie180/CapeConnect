import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";

import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import walletRoutes from "./routes/wallets.js";
import routeRoutes from "./routes/routes.js";
import timetableRoutes from "./routes/timetables.js";
import priceRoutes from "./routes/prices.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      const allowed = config.frontendOrigins || ["*"];
      if (allowed.includes("*")) return callback(null, true);
      // Allow tools/curl/postman requests that do not send an Origin header.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "capeconnect-backend", env: config.env });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiLimiter);
app.use("/api/tickets", ticketRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

export default app;
