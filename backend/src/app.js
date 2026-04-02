import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import * as Sentry from "@sentry/node";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import { createRequestId } from "./utils/logger.js";

import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import walletRoutes from "./routes/wallets.js";
import routeRoutes from "./routes/routes.js";
import timetableRoutes from "./routes/timetables.js";
import priceRoutes from "./routes/prices.js";
import adminRoutes from "./routes/admin.js";
import paymentRoutes from "./routes/payments.js";

const app = express();

// Initialize Sentry for error tracking
if (config.env === 'production' && config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
  });
  
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.disable("x-powered-by");

if (config.env === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    hsts: config.env === "production",
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      const allowed = config.frontendOrigins || ["*"];
      if (config.allowAnyOrigin) return callback(null, true);
      // Allow tools/curl/postman requests that do not send an Origin header.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.env === "production" ? "combined" : "dev"));
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || createRequestId();
  req.requestId = String(requestId);
  res.setHeader("x-request-id", String(requestId));
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "capeconnect-backend",
    env: config.env,
    time: new Date().toISOString(),
  });
});

app.get("/readyz", (_req, res) => {
  res.json({
    ok: true,
    service: "capeconnect-backend",
    env: config.env,
    database: config.useSqlite ? "sqlite" : "postgres",
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiLimiter);
app.use("/api/tickets", ticketRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Add Sentry error handler before the custom error handler
if (config.env === 'production' && config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(errorHandler);

export default app;
