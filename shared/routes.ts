import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { branches, users, services, appointments, feedbacks, notifications } from './schema';

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

// Error schemas
export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      }
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.object({ message: z.string() }),
      }
    }
  },
  branches: {
    list: {
      method: 'GET' as const,
      path: '/api/branches' as const,
      responses: { 200: z.array(z.custom<typeof branches.$inferSelect>()) }
    }
  },
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services' as const,
      responses: { 200: z.array(z.custom<typeof services.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/services' as const,
      input: insertServiceSchema,
      responses: { 201: z.custom<typeof services.$inferSelect>() }
    }
  },
  barbers: {
    list: {
      method: 'GET' as const,
      path: '/api/barbers' as const,
      responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/barbers' as const,
      input: insertUserSchema,
      responses: { 201: z.custom<typeof users.$inferSelect>() }
    }
  },
  appointments: {
    list: {
      method: 'GET' as const,
      path: '/api/appointments' as const,
      responses: { 200: z.array(z.custom<typeof appointments.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/appointments' as const,
      input: insertAppointmentSchema,
      responses: { 201: z.custom<typeof appointments.$inferSelect>() }
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/appointments/:id/status' as const,
      input: z.object({ status: z.string() }),
      responses: { 200: z.custom<typeof appointments.$inferSelect>() }
    }
  },
  feedbacks: {
    list: {
      method: 'GET' as const,
      path: '/api/feedbacks' as const,
      responses: { 200: z.array(z.custom<typeof feedbacks.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/feedbacks' as const,
      input: insertFeedbackSchema,
      responses: { 201: z.custom<typeof feedbacks.$inferSelect>() }
    }
  },
  notifications: {
    list: {
      method: 'GET' as const,
      path: '/api/notifications' as const,
      responses: { 200: z.array(z.custom<typeof notifications.$inferSelect>()) }
    },
    markRead: {
      method: 'PATCH' as const,
      path: '/api/notifications/:id/read' as const,
      responses: { 200: z.custom<typeof notifications.$inferSelect>() }
    }
  }
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
