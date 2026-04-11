import { log, serializeError } from "../utils/logger.js";
import { config } from "../config.js";

export const errorHandler = (err, req, res, _next) => {
  log("error", "request_failed", {
    requestId: req?.requestId || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.url || null,
    userId: req?.auth?.userId || null,
    error: serializeError(err),
  });

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      requestId: req?.requestId || null,
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    requestId: req?.requestId || null,
    ...(config.env === 'development' && { stack: err.stack })
  });
};

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
