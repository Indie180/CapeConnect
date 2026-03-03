import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";

import authRoutes from "./routes/auth.js";
import ticketRoutes from "./routes/tickets.js";
import walletRoutes from "./routes/wallets.js";
import routeRoutes from "./routes/routes.js";
import timetableRoutes from "./routes/timetables.js";
import priceRoutes from "./routes/prices.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "capeconnect-backend", env: config.env });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

export default app;
