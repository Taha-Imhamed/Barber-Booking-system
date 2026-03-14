import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import {
  branches,
  users,
  services,
  appointments,
  feedbacks,
  notifications,
  adminMessages,
  appointmentEarnings,
  guestNotifications,
  expenses,
  chatGroups,
  chatMessages,
  appSettings,
  reviews,
  waitlist,
  inventory,
  barberGallery,
  referrals,
  referralCodes,
  customerTags,
  marketingCampaigns,
  auditLogs,
} from "./schema";

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
const optionalTrimmedString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().optional(),
);
const optionalNullableString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().nullable().optional(),
);
const optionalEmail = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().email().optional(),
);

export const createBarberSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().trim().min(1, "Password is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: optionalEmail,
  phone: optionalTrimmedString,
  branchId: z.number().int().nullable().optional(),
  yearsOfExperience: z.number().int().nullable().optional(),
  bio: optionalNullableString,
  photoUrl: optionalNullableString,
  instagramUrl: optionalNullableString,
  loyaltyPoints: z.number().int().optional(),
  googleId: optionalTrimmedString,
  role: z.literal("barber").optional(),
});
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/auth/login" as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      },
    },
    register: {
      method: "POST" as const,
      path: "/api/auth/register" as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    google: {
      method: "GET" as const,
      path: "/api/auth/google" as const,
      responses: {
        302: z.object({ url: z.string() }),
      },
    },
    googleCallback: {
      method: "GET" as const,
      path: "/api/auth/google/callback" as const,
      responses: {
        302: z.object({ ok: z.boolean() }),
      },
    },
    facebook: {
      method: "GET" as const,
      path: "/api/auth/facebook" as const,
      responses: {
        501: z.object({ message: z.string() }),
      },
    },
    apple: {
      method: "GET" as const,
      path: "/api/auth/apple" as const,
      responses: {
        501: z.object({ message: z.string() }),
      },
    },
    verifyEmail: {
      method: "GET" as const,
      path: "/api/auth/verify-email" as const,
      responses: {
        200: z.object({ ok: z.boolean(), message: z.string() }),
        400: z.object({ ok: z.boolean(), message: z.string() }),
      },
    },
    resendVerification: {
      method: "POST" as const,
      path: "/api/auth/resend-verification" as const,
      input: z.object({ email: z.string().email() }),
      responses: {
        200: z.object({ ok: z.boolean(), message: z.string() }),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/auth/me" as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/auth/logout" as const,
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
  },
  branches: {
    list: {
      method: "GET" as const,
      path: "/api/branches" as const,
      responses: { 200: z.array(z.custom<typeof branches.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/branches" as const,
      input: insertBranchSchema,
      responses: { 201: z.custom<typeof branches.$inferSelect>() },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/branches/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  services: {
    list: {
      method: "GET" as const,
      path: "/api/services" as const,
      responses: { 200: z.array(z.custom<typeof services.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/services" as const,
      input: insertServiceSchema,
      responses: { 201: z.custom<typeof services.$inferSelect>() },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/services/:id" as const,
      input: insertServiceSchema.partial(),
      responses: { 200: z.custom<typeof services.$inferSelect>() },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/services/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
    barbers: {
      list: {
        method: "GET" as const,
        path: "/api/barbers" as const,
        responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) },
      },
      create: {
        method: "POST" as const,
        path: "/api/barbers" as const,
        input: createBarberSchema,
        responses: { 201: z.custom<typeof users.$inferSelect>() },
      },
    update: {
      method: "PATCH" as const,
      path: "/api/barbers/:id" as const,
      input: insertUserSchema.partial(),
      responses: { 200: z.custom<typeof users.$inferSelect>() },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/barbers/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  appointments: {
    list: {
      method: "GET" as const,
      path: "/api/appointments" as const,
      responses: { 200: z.array(z.custom<typeof appointments.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/appointments" as const,
      input: insertAppointmentSchema,
      responses: { 201: z.custom<typeof appointments.$inferSelect>() },
    },
    updateStatus: {
      method: "PATCH" as const,
      path: "/api/appointments/:id/status" as const,
      input: z.object({
        status: z.string(),
        tipAmount: z.number().optional(),
        proposedDate: z.string().optional(),
      }),
      responses: { 200: z.custom<typeof appointments.$inferSelect>() },
    },
    guestByPhone: {
      method: "GET" as const,
      path: "/api/appointments/guest" as const,
      responses: { 200: z.array(z.custom<typeof appointments.$inferSelect>()) },
    },
    respondProposedTime: {
      method: "PATCH" as const,
      path: "/api/appointments/:id/respond" as const,
      input: z.object({ action: z.enum(["accept", "decline"]) }),
      responses: { 200: z.custom<typeof appointments.$inferSelect>() },
    },
  },
  feedbacks: {
    list: {
      method: "GET" as const,
      path: "/api/feedbacks" as const,
      responses: { 200: z.array(z.custom<typeof feedbacks.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/feedbacks" as const,
      input: insertFeedbackSchema,
      responses: { 201: z.custom<typeof feedbacks.$inferSelect>() },
    },
  },
  notifications: {
    list: {
      method: "GET" as const,
      path: "/api/notifications" as const,
      responses: { 200: z.array(z.custom<typeof notifications.$inferSelect>()) },
    },
    markRead: {
      method: "PATCH" as const,
      path: "/api/notifications/:id/read" as const,
      responses: { 200: z.custom<typeof notifications.$inferSelect>() },
    },
    markAllRead: {
      method: "PATCH" as const,
      path: "/api/notifications/read-all" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  admin: {
    sendMessage: {
      method: "POST" as const,
      path: "/api/admin/messages" as const,
      input: z.object({
        appointmentId: z.number(),
        message: z.string().min(1),
      }),
      responses: {
        201: z.custom<typeof adminMessages.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    deleteAppointments: {
      method: "POST" as const,
      path: "/api/admin/appointments/delete" as const,
      input: z.object({ ids: z.array(z.coerce.number().int().positive()) }),
      responses: {
        200: z.object({ ok: z.boolean(), deleted: z.number() }),
      },
    },
    settings: {
      method: "POST" as const,
      path: "/api/admin/settings" as const,
      input: z.object({
        wallDisplayBackground: z.string().url().optional(),
        notificationSound: z.enum(["chime", "beep", "ding"]).optional(),
        wallShowWeather: z.boolean().optional(),
        wallShowMusic: z.boolean().optional(),
        wallQueueLimit: z.number().min(1).max(20).optional(),
      }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    usersList: {
      method: "GET" as const,
      path: "/api/admin/users" as const,
      responses: {
        200: z.object({
          ok: z.boolean(),
          users: z.array(z.any()),
          note: z.string().optional(),
        }),
      },
    },
    deleteUser: {
      method: "DELETE" as const,
      path: "/api/admin/users/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    developerSnapshot: {
      method: "GET" as const,
      path: "/api/admin/developer/snapshot" as const,
      responses: {
        200: z.object({
          ok: z.boolean(),
          snapshot: z.any(),
        }),
      },
    },
    developerExport: {
      method: "GET" as const,
      path: "/api/admin/developer/export" as const,
      responses: {
        200: z.any(),
      },
    },
    adminsList: {
      method: "GET" as const,
      path: "/api/admin/admins" as const,
      responses: {
        200: z.object({
          ok: z.boolean(),
          admins: z.array(
            z.object({
              id: z.number(),
              username: z.string().nullable(),
              firstName: z.string(),
              lastName: z.string(),
              email: z.string().nullable(),
              adminPermissions: z.string().nullable(),
              isMainAdmin: z.boolean(),
            }),
          ),
        }),
      },
    },
    createAdmin: {
      method: "POST" as const,
      path: "/api/admin/admins" as const,
      input: z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        permissions: z.array(z.string()).default([]),
      }),
      responses: {
        201: z.object({ ok: z.boolean(), user: z.any() }),
      },
    },
    updateAdminPermissions: {
      method: "PATCH" as const,
      path: "/api/admin/admins/:id/permissions" as const,
      input: z.object({ permissions: z.array(z.string()) }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    changeAdminPassword: {
      method: "PATCH" as const,
      path: "/api/admin/admins/:id/password" as const,
      input: z.object({ username: z.string().min(3).optional(), password: z.string().min(6).optional() }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    developerSchema: {
      method: "GET" as const,
      path: "/api/admin/developer/schema" as const,
      responses: {
        200: z.object({ ok: z.boolean(), schema: z.any() }),
      },
    },
    developerSqlReport: {
      method: "GET" as const,
      path: "/api/admin/developer/sql-report" as const,
      responses: {
        200: z.object({ ok: z.boolean(), report: z.any() }),
      },
    },
    developerSqlExport: {
      method: "GET" as const,
      path: "/api/admin/developer/sql-export" as const,
      responses: {
        200: z.any(),
      },
    },
  },
  earnings: {
    summary: {
      method: "GET" as const,
      path: "/api/earnings/summary" as const,
      responses: {
        200: z.object({
          barberDailyTotal: z.number(),
          branchDailyTotal: z.number(),
          totalProfit: z.number(),
          totalExpenses: z.number(),
          netProfit: z.number(),
          branchTotals: z.array(z.object({ branchId: z.number(), branchName: z.string(), total: z.number() })),
          barberTotals: z.array(z.object({ barberId: z.number(), barberName: z.string(), total: z.number() })),
        }),
      },
    },
  },
  guestNotifications: {
    list: {
      method: "GET" as const,
      path: "/api/guest-notifications" as const,
      responses: {
        200: z.array(z.custom<typeof guestNotifications.$inferSelect>()),
      },
    },
    markRead: {
      method: "PATCH" as const,
      path: "/api/guest-notifications/:id/read" as const,
      responses: {
        200: z.custom<typeof guestNotifications.$inferSelect>(),
      },
    },
  },
  expenses: {
    list: {
      method: "GET" as const,
      path: "/api/expenses" as const,
      responses: { 200: z.array(z.custom<typeof expenses.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/expenses" as const,
      input: z.object({ title: z.string().min(1), amount: z.number(), branchId: z.number().nullable().optional() }),
      responses: { 201: z.custom<typeof expenses.$inferSelect>() },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/expenses/:id" as const,
      input: z.object({
        title: z.string().min(1).optional(),
        amount: z.number().optional(),
        branchId: z.number().nullable().optional(),
      }),
      responses: { 200: z.custom<typeof expenses.$inferSelect>() },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/expenses/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  chat: {
    groups: {
      method: "GET" as const,
      path: "/api/chat/groups" as const,
      responses: { 200: z.array(z.custom<typeof chatGroups.$inferSelect>()) },
    },
    createGroup: {
      method: "POST" as const,
      path: "/api/chat/groups" as const,
      input: z.object({
        name: z.string().min(1),
        mode: z.enum(["text_numbers", "numbers_only"]),
        memberIds: z.array(z.number()),
      }),
      responses: { 201: z.custom<typeof chatGroups.$inferSelect>() },
    },
    deleteGroup: {
      method: "DELETE" as const,
      path: "/api/chat/groups/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    updateMembers: {
      method: "POST" as const,
      path: "/api/chat/groups/:id/members" as const,
      input: z.object({ memberIds: z.array(z.number()) }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    members: {
      method: "GET" as const,
      path: "/api/chat/groups/:id/members" as const,
      responses: { 200: z.array(z.object({ userId: z.number() })) },
    },
    messages: {
      method: "GET" as const,
      path: "/api/chat/groups/:id/messages" as const,
      responses: { 200: z.array(z.custom<typeof chatMessages.$inferSelect>()) },
    },
    sendMessage: {
      method: "POST" as const,
      path: "/api/chat/groups/:id/messages" as const,
      input: z.object({ content: z.string().min(1) }),
      responses: { 201: z.custom<typeof chatMessages.$inferSelect>() },
    },
    totals: {
      method: "GET" as const,
      path: "/api/chat/groups/:id/totals" as const,
      responses: {
        200: z.object({
          groupTotal: z.number(),
          byUser: z.array(z.object({ userId: z.number(), total: z.number() })),
        }),
      },
    },
  },
  calendar: {
    events: {
      method: "GET" as const,
      path: "/api/calendar/events" as const,
      responses: { 200: z.array(z.any()) },
    },
    moveAppointment: {
      method: "PATCH" as const,
      path: "/api/calendar/appointments/:id/move" as const,
      input: z.object({ appointmentDate: z.string() }),
      responses: { 200: z.any() },
    },
  },
  clientHistory: {
    profile: {
      method: "GET" as const,
      path: "/api/clients/:id/history" as const,
      responses: { 200: z.any() },
    },
  },
  reviews: {
    list: {
      method: "GET" as const,
      path: "/api/reviews" as const,
      responses: { 200: z.array(z.custom<typeof reviews.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/reviews" as const,
      input: z.object({
        appointmentId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }),
      responses: { 201: z.custom<typeof reviews.$inferSelect>() },
    },
    moderate: {
      method: "PATCH" as const,
      path: "/api/reviews/:id/moderate" as const,
      input: z.object({ isApproved: z.boolean() }),
      responses: { 200: z.custom<typeof reviews.$inferSelect>() },
    },
    average: {
      method: "GET" as const,
      path: "/api/reviews/barber/:barberId/average" as const,
      responses: { 200: z.object({ barberId: z.number(), averageRating: z.number(), count: z.number() }) },
    },
  },
  waitlist: {
    list: {
      method: "GET" as const,
      path: "/api/waitlist" as const,
      responses: { 200: z.array(z.custom<typeof waitlist.$inferSelect>()) },
    },
    join: {
      method: "POST" as const,
      path: "/api/waitlist" as const,
      input: z.object({ serviceId: z.number(), date: z.string() }),
      responses: { 201: z.custom<typeof waitlist.$inferSelect>() },
    },
    claim: {
      method: "PATCH" as const,
      path: "/api/waitlist/:id/claim" as const,
      responses: { 200: z.custom<typeof waitlist.$inferSelect>() },
    },
  },
  inventory: {
    list: {
      method: "GET" as const,
      path: "/api/inventory" as const,
      responses: { 200: z.array(z.custom<typeof inventory.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/inventory" as const,
      input: z.object({
        productName: z.string().min(1),
        stockQuantity: z.number().int().min(0),
        price: z.number().int().min(0),
      }),
      responses: { 201: z.custom<typeof inventory.$inferSelect>() },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/inventory/:id" as const,
      input: z.object({
        productName: z.string().min(1).optional(),
        stockQuantity: z.number().int().min(0).optional(),
        price: z.number().int().min(0).optional(),
      }),
      responses: { 200: z.custom<typeof inventory.$inferSelect>() },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/inventory/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    sale: {
      method: "POST" as const,
      path: "/api/inventory/:id/sale" as const,
      input: z.object({ quantity: z.number().int().min(1) }),
      responses: { 200: z.any() },
    },
  },
  analytics: {
    dashboard: {
      method: "GET" as const,
      path: "/api/analytics/dashboard" as const,
      responses: { 200: z.any() },
    },
  },
  aiAssistant: {
    suggest: {
      method: "POST" as const,
      path: "/api/ai/suggest" as const,
      input: z.object({ prompt: z.string().min(1) }),
      responses: { 200: z.object({ answer: z.string() }) },
    },
  },
  referrals: {
    myCode: {
      method: "GET" as const,
      path: "/api/referrals/code" as const,
      responses: { 200: z.custom<typeof referralCodes.$inferSelect>() },
    },
    apply: {
      method: "POST" as const,
      path: "/api/referrals/apply" as const,
      input: z.object({ code: z.string().min(3) }),
      responses: { 200: z.custom<typeof referrals.$inferSelect>() },
    },
  },
  gallery: {
    list: {
      method: "GET" as const,
      path: "/api/gallery/:barberId" as const,
      responses: { 200: z.array(z.custom<typeof barberGallery.$inferSelect>()) },
    },
    add: {
      method: "POST" as const,
      path: "/api/gallery" as const,
      input: z.object({
        barberId: z.coerce.number().optional(),
        imageUrl: z.string().min(1),
        caption: z.string().optional(),
      }),
      responses: { 201: z.custom<typeof barberGallery.$inferSelect>() },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/gallery/:id" as const,
      input: z.object({
        imageUrl: z.string().min(1).optional(),
        caption: z.string().optional(),
      }),
      responses: { 200: z.custom<typeof barberGallery.$inferSelect>() },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/gallery/:id" as const,
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  landingMedia: {
    get: {
      method: "GET" as const,
      path: "/api/landing-media" as const,
      responses: {
        200: z.object({
          photos: z.array(z.object({ id: z.string(), title: z.string(), imageUrl: z.string() })),
          videos: z.array(z.object({ id: z.string(), title: z.string(), videoUrl: z.string() })),
        }),
      },
    },
    save: {
      method: "POST" as const,
      path: "/api/admin/landing-media" as const,
      input: z.object({
        photos: z.array(z.object({ id: z.string(), title: z.string(), imageUrl: z.string() })),
        videos: z.array(z.object({ id: z.string(), title: z.string(), videoUrl: z.string() })),
      }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  customerTags: {
    list: {
      method: "GET" as const,
      path: "/api/customer-tags" as const,
      responses: { 200: z.array(z.custom<typeof customerTags.$inferSelect>()) },
    },
    create: {
      method: "POST" as const,
      path: "/api/customer-tags" as const,
      input: z.object({ name: z.string().min(1) }),
      responses: { 201: z.custom<typeof customerTags.$inferSelect>() },
    },
    assign: {
      method: "POST" as const,
      path: "/api/customer-tags/assign" as const,
      input: z.object({ userId: z.number(), tagId: z.number() }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
    usersByTag: {
      method: "GET" as const,
      path: "/api/customer-tags/:tagId/users" as const,
      responses: { 200: z.array(z.any()) },
    },
  },
  campaigns: {
    list: {
      method: "GET" as const,
      path: "/api/campaigns" as const,
      responses: { 200: z.array(z.custom<typeof marketingCampaigns.$inferSelect>()) },
    },
    send: {
      method: "POST" as const,
      path: "/api/campaigns" as const,
      input: z.object({
        title: z.string().min(1),
        message: z.string().min(1),
        channel: z.enum(["email", "sms"]).default("email"),
        targetTagId: z.number().optional(),
      }),
      responses: { 201: z.custom<typeof marketingCampaigns.$inferSelect>() },
    },
  },
  geo: {
    nearest: {
      method: "GET" as const,
      path: "/api/geo/nearest-branch" as const,
      responses: { 200: z.any() },
    },
  },
  cancellationPolicy: {
    get: {
      method: "GET" as const,
      path: "/api/cancellation-policy" as const,
      responses: { 200: z.any() },
    },
    set: {
      method: "POST" as const,
      path: "/api/cancellation-policy" as const,
      input: z.object({ freeCancelHours: z.number().int().min(0), lateFee: z.number().int().min(0) }),
      responses: { 200: z.object({ ok: z.boolean() }) },
    },
  },
  audit: {
    list: {
      method: "GET" as const,
      path: "/api/audit-logs" as const,
      responses: { 200: z.array(z.custom<typeof auditLogs.$inferSelect>()) },
    },
  },
  settings: {
    public: {
      method: "GET" as const,
      path: "/api/settings/public" as const,
      responses: {
        200: z.object({
          wallDisplayBackground: z.string(),
          notificationSound: z.enum(["chime", "beep", "ding"]),
          wallShowWeather: z.boolean(),
          wallShowMusic: z.boolean(),
          wallQueueLimit: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type UserType = typeof users.$inferSelect;
export type BranchType = typeof branches.$inferSelect;
export type ServiceType = typeof services.$inferSelect;
export type AppointmentType = typeof appointments.$inferSelect;
export type FeedbackType = typeof feedbacks.$inferSelect;
export type NotificationType = typeof notifications.$inferSelect;
export type AppointmentEarningType = typeof appointmentEarnings.$inferSelect;
export type GuestNotificationType = typeof guestNotifications.$inferSelect;
export type ExpenseType = typeof expenses.$inferSelect;
export type ReviewType = typeof reviews.$inferSelect;
export type WaitlistType = typeof waitlist.$inferSelect;
export type InventoryType = typeof inventory.$inferSelect;
export type BarberGalleryType = typeof barberGallery.$inferSelect;
export type ReferralType = typeof referrals.$inferSelect;
export type CustomerTagType = typeof customerTags.$inferSelect;
export type MarketingCampaignType = typeof marketingCampaigns.$inferSelect;
