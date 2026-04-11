import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function getDefaultFrontendOrigins(env) {
  if (env === "production") {
    return ["*"];
  }

  return ["http://localhost:4173", "http://127.0.0.1:4173"];
}

const inferredEnv = process.env.NODE_ENV || "development";
const rawEnv = {
  ...process.env,
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || getDefaultFrontendOrigins(inferredEnv).join(","),
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    USE_SQLITE: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    DATABASE_URL: z.string().optional(),
    FRONTEND_ORIGIN: z.string().default("*"),
    SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    QR_SECRET: z.string().optional(),
    PAYFAST_MERCHANT_ID: z.string().optional(),
    PAYFAST_MERCHANT_KEY: z.string().optional(),
    PAYFAST_PASSPHRASE: z.string().optional(),
    API_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((raw, ctx) => {
    const frontendOrigins = String(raw.FRONTEND_ORIGIN || "*")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!raw.USE_SQLITE && !raw.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when USE_SQLITE is false.",
        path: ["DATABASE_URL"],
      });
    }

    if (raw.NODE_ENV === "production" && frontendOrigins.includes("*")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FRONTEND_ORIGIN cannot use '*' in production. Set explicit frontend origins.",
        path: ["FRONTEND_ORIGIN"],
      });
    }

    if (raw.NODE_ENV === "production" && !raw.QR_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "QR_SECRET is required in production.",
        path: ["QR_SECRET"],
      });
    }

    if (raw.NODE_ENV === "production" && (!raw.PAYFAST_MERCHANT_ID || !raw.PAYFAST_MERCHANT_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are required in production.",
        path: ["PAYFAST_MERCHANT_ID"],
      });
    }

    if (raw.NODE_ENV === "production" && !raw.API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "API_URL is required in production.",
        path: ["API_URL"],
      });
    }

    if (raw.NODE_ENV === "production" && !raw.FRONTEND_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FRONTEND_URL is required in production.",
        path: ["FRONTEND_URL"],
      });
    }
  });

const parsedEnv = envSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid backend environment configuration: ${details}`);
}

const frontendOrigins = String(parsedEnv.data.FRONTEND_ORIGIN || "*")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const config = {
  env: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  useSqlite: parsedEnv.data.USE_SQLITE,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  frontendOrigins,
  allowAnyOrigin: frontendOrigins.includes("*"),
  sessionTtlMinutes: parsedEnv.data.SESSION_TTL_MINUTES,
  refreshTtlDays: parsedEnv.data.REFRESH_TTL_DAYS,
  qrSecret: parsedEnv.data.QR_SECRET || "capeconnect-qr-secret-dev",
  payfastMerchantId: parsedEnv.data.PAYFAST_MERCHANT_ID,
  payfastMerchantKey: parsedEnv.data.PAYFAST_MERCHANT_KEY,
  payfastPassphrase: parsedEnv.data.PAYFAST_PASSPHRASE,
  apiUrl: parsedEnv.data.API_URL,
  frontendUrl: parsedEnv.data.FRONTEND_URL,
  sentryDsn: parsedEnv.data.SENTRY_DSN,
};
