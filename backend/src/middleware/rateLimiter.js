import rateLimit from 'express-rate-limit';

function skipInTestEnv() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'test';
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTestEnv,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  skip: skipInTestEnv,
});
