import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const ticketSchema = z.object({
  route_id: z.number().int().positive(),
  price: z.number().positive(),
});

export const walletTopupSchema = z.object({
  amount: z.number().positive().max(10000, 'Maximum top-up is 10000'),
});

export const walletSpendSchema = z.object({
  amount: z.number().positive(),
});

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};
