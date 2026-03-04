import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { branches, users, services, appointments, feedbacks, notifications, adminMessages, appointmentEarnings, guestNotifications, expenses, chatGroups, chatMessages, appSettings } from "./schema";

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
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
      input: insertUserSchema,
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
      input: z.object({ ids: z.array(z.number()) }),
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
