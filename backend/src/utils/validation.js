import { z } from "zod";

const operatorSchema = z.enum(["MyCiTi", "Golden Arrow"]);
const optionalDateString = z.string().datetime().optional().nullable();

export const authLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const authRegisterSchema = z.object({
  fullName: z.string().trim().min(1, "fullName is required"),
  email: z.string().email("A valid email address is required"),
  phone: z.string().trim().max(50).optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const authForgotPasswordSchema = z.object({
  email: z.string().email("A valid email address is required"),
});

export const authResetPasswordSchema = z.object({
  token: z.string().trim().min(1, "token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const authChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const walletMutationSchema = z.object({
  amountCents: z.coerce.number().int().positive("amountCents must be > 0").max(1_000_000),
  operator: z.string().trim().optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

export const adminUsersBulkSchema = z.object({
  operator: operatorSchema,
  users: z.array(
    z.object({
      id: z.string().trim().min(1),
      fullName: z.string().trim().min(1).max(120),
      email: z.string().email(),
      phone: z.string().trim().max(50).optional().nullable(),
      status: z.enum(["ACTIVE", "DEACTIVATED", "BLACKLISTED", "DELETED"]).default("ACTIVE"),
      blacklistReason: z.string().trim().max(250).optional().nullable(),
      blacklistUntil: optionalDateString,
    })
  ).max(5000),
});

export const adminTicketsBulkSchema = z.object({
  operator: operatorSchema,
  tickets: z.array(
    z.object({
      id: z.string().trim().optional().nullable(),
      userId: z.string().trim().min(1),
      productType: z.string().trim().min(1).max(80),
      productName: z.string().trim().min(1).max(120),
      journeysIncluded: z.coerce.number().int().min(0).optional().nullable(),
      journeysUsed: z.coerce.number().int().min(0).default(0),
      routeFrom: z.string().trim().max(120).optional().nullable(),
      routeTo: z.string().trim().max(120).optional().nullable(),
      amount: z.coerce.number().min(0),
      currency: z.string().trim().min(1).max(10).default("ZAR"),
      status: z.enum(["PAID", "USED", "EXPIRED", "REFUNDED", "CANCELLED"]).default("PAID"),
      purchasedAt: optionalDateString,
      validFrom: optionalDateString,
      validUntil: optionalDateString,
      paymentMethod: z.string().trim().min(1).max(50).default("CARD"),
      cardAlias: z.string().trim().max(80).optional().nullable(),
      meta: z.record(z.any()).optional().default({}),
    })
  ).max(5000),
});

export const adminWalletsBulkSchema = z.object({
  operator: operatorSchema,
  wallets: z.array(
    z.object({
      userId: z.string().trim().min(1),
      balance: z.coerce.number().min(0),
      currency: z.string().trim().min(1).max(10).default("ZAR"),
      transactions: z.array(
        z.object({
          id: z.string().trim().optional().nullable(),
          type: z.string().trim().min(1).max(40),
          amount: z.coerce.number(),
          refTicketId: z.string().trim().optional().nullable(),
          note: z.string().trim().max(200).optional().nullable(),
          at: optionalDateString,
        })
      ).max(10000).optional().default([]),
    })
  ).max(5000),
});

export const adminPricesGlobalBulkSchema = z.object({
  operator: operatorSchema,
  pricesGlobal: z.array(
    z.object({
      key: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(120),
      journeys: z.coerce.number().int().min(0).optional().nullable(),
      price: z.coerce.number().min(0),
    })
  ).max(500),
});

export const adminPricesRoutesBulkSchema = z.object({
  operator: operatorSchema,
  pricesRoutes: z.array(
    z.object({
      id: z.string().trim().optional().nullable(),
      from: z.string().trim().min(1).max(120),
      to: z.string().trim().min(1).max(120),
      five_ride: z.coerce.number().min(0).default(0),
      weekly: z.coerce.number().min(0).default(0),
      monthly: z.coerce.number().min(0).default(0),
    })
  ).max(5000),
});

export const adminTimetablesBulkSchema = z.object({
  operator: operatorSchema,
  timetables: z.array(
    z.object({
      id: z.string().trim().optional().nullable(),
      routeName: z.string().trim().min(1).max(120),
      routeCode: z.string().trim().max(80).optional().nullable(),
      direction: z.string().trim().min(1).max(40).default("Outbound"),
      dayType: z.string().trim().min(1).max(40).default("Weekday"),
      stops: z.array(z.object({ name: z.string().trim().min(1).max(120) })).max(500).default([]),
      times: z.array(z.any()).max(2000).default([]),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
      effectiveFrom: optionalDateString,
      deleted: z.coerce.boolean().default(false),
    })
  ).max(3000),
});

export const adminAuditEntrySchema = z.object({
  operator: operatorSchema,
  entry: z.object({
    id: z.string().trim().optional().nullable(),
    at: optionalDateString,
    adminEmail: z.string().email().optional().nullable(),
    action: z.string().trim().min(1).max(80),
    targetType: z.string().trim().min(1).max(80),
    targetId: z.string().trim().max(120).optional().nullable(),
    before: z.any().optional().nullable(),
    after: z.any().optional().nullable(),
  }),
});

export function parseOrThrow(schema, payload) {
  return schema.parse(payload);
}
