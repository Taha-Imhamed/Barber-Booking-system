import { db } from "./db";
import {
  users,
  branches,
  services,
  appointments,
  feedbacks,
  notifications,
  emailVerificationTokens,
  adminMessages,
  appointmentEarnings,
  guestNotifications,
  expenses,
  chatGroups,
  chatGroupMembers,
  chatMessages,
  appSettings,
  appointmentServices,
  appointmentReminders,
  reviews,
  type UserType,
  type BranchType,
  type ServiceType,
  type AppointmentType,
  type FeedbackType,
  type NotificationType,
  type EmailVerificationTokenType,
  type AdminMessageType,
  type AppointmentEarningType,
  type GuestNotificationType,
  type ExpenseType,
  type ChatGroupType,
  type ChatGroupMemberType,
  type ChatMessageType,
  type AppSettingType,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users (Auth & Barbers)
  getUser(id: number): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  getUserByEmail(email: string): Promise<UserType | undefined>;
  getUserByGoogleId(googleId: string): Promise<UserType | undefined>;
  getUsers(): Promise<UserType[]>;
  createUser(user: typeof users.$inferInsert): Promise<UserType>;
  updateUser(id: number, user: Partial<Omit<UserType, "id">>): Promise<UserType>;
  updateUserLoyaltyPoints(userId: number, pointsToAdd: number): Promise<UserType | undefined>;
  getBarbers(): Promise<UserType[]>;
  deleteBarber(id: number): Promise<boolean>;
  
  // Branches
  getBranches(): Promise<BranchType[]>;
  createBranch(branch: typeof branches.$inferInsert): Promise<BranchType>;
  deleteBranch(id: number): Promise<boolean>;
  
  // Services
  getServices(): Promise<ServiceType[]>;
  createService(service: Omit<ServiceType, "id">): Promise<ServiceType>;
  updateService(id: number, service: Partial<Omit<ServiceType, "id">>): Promise<ServiceType>;
  
  // Appointments
  getAppointments(): Promise<AppointmentType[]>;
  getAppointment(id: number): Promise<AppointmentType | undefined>;
  getAppointmentsByBarber(barberId: number): Promise<AppointmentType[]>;
  createAppointment(appointment: typeof appointments.$inferInsert): Promise<AppointmentType>;
  updateAppointmentStatus(id: number, status: string): Promise<AppointmentType>;
  updateAppointment(id: number, data: Partial<Omit<AppointmentType, "id" | "createdAt">>): Promise<AppointmentType>;
  getAppointmentsByGuestPhone(phone: string): Promise<AppointmentType[]>;
  deleteAppointmentsByIds(ids: number[]): Promise<number>;
  
  // Feedbacks
  getFeedbacks(): Promise<FeedbackType[]>;
  createFeedback(feedback: Omit<FeedbackType, "id" | "createdAt">): Promise<FeedbackType>;
  
  // Notifications
  getNotifications(userId: number): Promise<NotificationType[]>;
  createNotification(notification: Omit<NotificationType, "id" | "createdAt">): Promise<NotificationType>;
  markNotificationRead(id: number): Promise<NotificationType>;
  markAllNotificationsRead(userId: number): Promise<boolean>;

  // Email verification
  createEmailVerificationToken(token: Omit<EmailVerificationTokenType, "id" | "createdAt" | "usedAt">): Promise<EmailVerificationTokenType>;
  getValidEmailVerificationToken(token: string): Promise<EmailVerificationTokenType | undefined>;
  markEmailVerificationTokenUsed(id: number): Promise<EmailVerificationTokenType>;

  // Admin message logs
  createAdminMessage(message: Omit<AdminMessageType, "id" | "createdAt">): Promise<AdminMessageType>;
  getAdminMessagesForAppointment(appointmentId: number): Promise<AdminMessageType[]>;

  // Earnings
  createAppointmentEarning(input: Omit<AppointmentEarningType, "id" | "earnedAt">): Promise<AppointmentEarningType>;
  getAppointmentEarningByAppointmentId(appointmentId: number): Promise<AppointmentEarningType | undefined>;
  getDailyBarberEarnings(barberId: number, dayStart: Date, dayEnd: Date): Promise<number>;
  getDailyBranchEarnings(branchId: number, dayStart: Date, dayEnd: Date): Promise<number>;

  // Guest notifications
  createGuestNotification(input: Omit<GuestNotificationType, "id" | "createdAt">): Promise<GuestNotificationType>;
  getGuestNotificationsByPhone(phone: string): Promise<GuestNotificationType[]>;
  markGuestNotificationRead(id: number): Promise<GuestNotificationType>;

  // Expenses
  getExpenses(): Promise<ExpenseType[]>;
  createExpense(input: Omit<ExpenseType, "id" | "createdAt">): Promise<ExpenseType>;
  updateExpense(id: number, input: Partial<Omit<ExpenseType, "id" | "createdAt" | "createdByUserId">>): Promise<ExpenseType>;
  deleteExpense(id: number): Promise<boolean>;

  // Group chat
  getChatGroups(): Promise<ChatGroupType[]>;
  getChatGroupsForUser(userId: number): Promise<ChatGroupType[]>;
  createChatGroup(input: Omit<ChatGroupType, "id" | "createdAt">): Promise<ChatGroupType>;
  addChatGroupMembers(groupId: number, userIds: number[]): Promise<void>;
  getChatGroupMembers(groupId: number): Promise<ChatGroupMemberType[]>;
  getChatMessages(groupId: number): Promise<ChatMessageType[]>;
  createChatMessage(input: Omit<ChatMessageType, "id" | "createdAt">): Promise<ChatMessageType>;
  removeAllChatGroupMembers(groupId: number): Promise<void>;
  getChatGroup(groupId: number): Promise<ChatGroupType | undefined>;
  deleteChatGroup(groupId: number): Promise<boolean>;

  // App settings
  setAppSetting(key: string, value: string): Promise<void>;
  getAppSetting(key: string): Promise<string | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<UserType | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<UserType | undefined> {
    const normalized = username.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${normalized}`);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserType | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<UserType | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async getUsers(): Promise<UserType[]> {
    return await db.select().from(users).orderBy(desc(users.id));
  }
  
  async createUser(user: typeof users.$inferInsert): Promise<UserType> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<Omit<UserType, "id">>): Promise<UserType> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async updateUserLoyaltyPoints(userId: number, pointsToAdd: number): Promise<UserType | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    const nextPoints = (user.loyaltyPoints ?? 0) + pointsToAdd;
    const [updated] = await db
      .update(users)
      .set({ loyaltyPoints: Math.max(0, nextPoints) })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }
  
  async getBarbers(): Promise<UserType[]> {
    return await db.select().from(users).where(eq(users.role, 'barber'));
  }

  async deleteBarber(id: number): Promise<boolean> {
    const [updated] = await db
      .update(users)
      .set({
        role: "client",
        isAvailable: false,
        branchId: null,
        adminPermissions: "[]",
      })
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return Boolean(updated);
  }
  
  // Branches
  async getBranches(): Promise<BranchType[]> {
    return await db.select().from(branches);
  }
  
  async createBranch(branch: typeof branches.$inferInsert): Promise<BranchType> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }

  async deleteBranch(id: number): Promise<boolean> {
    const deleted = await db.delete(branches).where(eq(branches.id, id)).returning({ id: branches.id });
    return deleted.length > 0;
  }
  
  // Services
  async getServices(): Promise<ServiceType[]> {
    return await db.select().from(services);
  }
  
  async createService(service: Omit<ServiceType, "id">): Promise<ServiceType> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<Omit<ServiceType, "id">>): Promise<ServiceType> {
    const [updatedService] = await db.update(services).set(service).where(eq(services.id, id)).returning();
    return updatedService;
  }
  
  // Appointments
  async getAppointments(): Promise<AppointmentType[]> {
    const items = await db.select().from(appointments).orderBy(desc(appointments.appointmentDate));
    return items.filter((a) => !a.isDeleted);
  }

  async getAppointment(id: number): Promise<AppointmentType | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    if (!appointment || appointment.isDeleted) return undefined;
    return appointment;
  }
  
  async getAppointmentsByBarber(barberId: number): Promise<AppointmentType[]> {
    const items = await db.select().from(appointments).where(eq(appointments.barberId, barberId)).orderBy(desc(appointments.appointmentDate));
    return items.filter((a) => !a.isDeleted);
  }
  
  async createAppointment(appointment: typeof appointments.$inferInsert): Promise<AppointmentType> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }
  
  async updateAppointmentStatus(id: number, status: string): Promise<AppointmentType> {
    const [updated] = await db.update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  async updateAppointment(id: number, data: Partial<Omit<AppointmentType, "id" | "createdAt">>): Promise<AppointmentType> {
    const [updated] = await db.update(appointments).set(data).where(eq(appointments.id, id)).returning();
    return updated;
  }

  async getAppointmentsByGuestPhone(phone: string): Promise<AppointmentType[]> {
    const normalize = (v: string) => v.replace(/\D/g, "");
    const target = normalize(phone);
    const items = await db.select().from(appointments).orderBy(desc(appointments.appointmentDate));
    return items.filter((i) => !i.isDeleted && normalize(i.guestPhone ?? "") === target);
  }

  async deleteAppointmentsByIds(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const all = await db.select().from(appointments);
    const set = new Set(ids.map((v) => Number(v)));
    const idsToDelete = all.filter((a) => set.has(Number(a.id))).map((a) => a.id);
    if (idsToDelete.length === 0) return 0;
    const now = new Date();
    let updated = 0;
    for (const id of idsToDelete) {
      const rows = await db
        .update(appointments)
        .set({ isDeleted: true, cancelledAt: now })
        .where(eq(appointments.id, id))
        .returning({ id: appointments.id });
      updated += rows.length;
    }
    return updated;
  }
  
  // Feedbacks
  async getFeedbacks(): Promise<FeedbackType[]> {
    return await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
  }
  
  async createFeedback(feedback: Omit<FeedbackType, "id" | "createdAt">): Promise<FeedbackType> {
    const [newFeedback] = await db.insert(feedbacks).values(feedback).returning();
    return newFeedback;
  }
  
  // Notifications
  async getNotifications(userId: number): Promise<NotificationType[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }
  
  async createNotification(notification: Omit<NotificationType, "id" | "createdAt">): Promise<NotificationType> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }
  
  async markNotificationRead(id: number): Promise<NotificationType> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: number): Promise<boolean> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
    return true;
  }

  async createEmailVerificationToken(
    tokenInput: Omit<EmailVerificationTokenType, "id" | "createdAt" | "usedAt">,
  ): Promise<EmailVerificationTokenType> {
    const [token] = await db.insert(emailVerificationTokens).values(tokenInput).returning();
    return token;
  }

  async getValidEmailVerificationToken(tokenValue: string): Promise<EmailVerificationTokenType | undefined> {
    const [token] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        eq(emailVerificationTokens.token, tokenValue),
      );
    if (!token) return undefined;
    if (token.usedAt) return undefined;
    if (token.expiresAt.getTime() < Date.now()) return undefined;
    return token;
  }

  async markEmailVerificationTokenUsed(id: number): Promise<EmailVerificationTokenType> {
    const [token] = await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, id))
      .returning();
    return token;
  }

  async createAdminMessage(message: Omit<AdminMessageType, "id" | "createdAt">): Promise<AdminMessageType> {
    const [item] = await db.insert(adminMessages).values(message).returning();
    return item;
  }

  async getAdminMessagesForAppointment(appointmentId: number): Promise<AdminMessageType[]> {
    return db.select().from(adminMessages).where(eq(adminMessages.appointmentId, appointmentId)).orderBy(desc(adminMessages.createdAt));
  }

  async createAppointmentEarning(input: Omit<AppointmentEarningType, "id" | "earnedAt">): Promise<AppointmentEarningType> {
    const [item] = await db.insert(appointmentEarnings).values(input).returning();
    return item;
  }

  async getAppointmentEarningByAppointmentId(appointmentId: number): Promise<AppointmentEarningType | undefined> {
    const [item] = await db.select().from(appointmentEarnings).where(eq(appointmentEarnings.appointmentId, appointmentId));
    return item;
  }

  async getDailyBarberEarnings(barberId: number, dayStart: Date, dayEnd: Date): Promise<number> {
    const items = await db.select().from(appointmentEarnings).where(eq(appointmentEarnings.barberId, barberId));
    return items
      .filter((i) => i.earnedAt && i.earnedAt >= dayStart && i.earnedAt < dayEnd)
      .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  }

  async getDailyBranchEarnings(branchId: number, dayStart: Date, dayEnd: Date): Promise<number> {
    const items = await db.select().from(appointmentEarnings).where(eq(appointmentEarnings.branchId, branchId));
    return items
      .filter((i) => i.earnedAt && i.earnedAt >= dayStart && i.earnedAt < dayEnd)
      .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  }

  async createGuestNotification(input: Omit<GuestNotificationType, "id" | "createdAt">): Promise<GuestNotificationType> {
    const [item] = await db.insert(guestNotifications).values(input).returning();
    return item;
  }

  async getGuestNotificationsByPhone(phone: string): Promise<GuestNotificationType[]> {
    const normalize = (v: string) => v.replace(/\D/g, "");
    const target = normalize(phone);
    const items = await db.select().from(guestNotifications).orderBy(desc(guestNotifications.createdAt));
    return items.filter((i) => normalize(i.guestPhone) === target);
  }

  async markGuestNotificationRead(id: number): Promise<GuestNotificationType> {
    const [item] = await db.update(guestNotifications).set({ isRead: true }).where(eq(guestNotifications.id, id)).returning();
    return item;
  }

  async getExpenses(): Promise<ExpenseType[]> {
    return db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async createExpense(input: Omit<ExpenseType, "id" | "createdAt">): Promise<ExpenseType> {
    const [item] = await db.insert(expenses).values(input).returning();
    return item;
  }

  async updateExpense(id: number, input: Partial<Omit<ExpenseType, "id" | "createdAt" | "createdByUserId">>): Promise<ExpenseType> {
    const [item] = await db.update(expenses).set(input).where(eq(expenses.id, id)).returning();
    return item;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const deleted = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return deleted.length > 0;
  }

  async getChatGroups(): Promise<ChatGroupType[]> {
    return db.select().from(chatGroups).orderBy(desc(chatGroups.createdAt));
  }

  async getChatGroupsForUser(userId: number): Promise<ChatGroupType[]> {
    const memberships = await db.select().from(chatGroupMembers).where(eq(chatGroupMembers.userId, userId));
    const groupIds = new Set(memberships.map((m) => m.groupId));
    const groups = await db.select().from(chatGroups).orderBy(desc(chatGroups.createdAt));
    return groups.filter((g) => groupIds.has(g.id));
  }

  async createChatGroup(input: Omit<ChatGroupType, "id" | "createdAt">): Promise<ChatGroupType> {
    const [item] = await db.insert(chatGroups).values(input).returning();
    return item;
  }

  async addChatGroupMembers(groupId: number, userIds: number[]): Promise<void> {
    if (userIds.length === 0) return;
    await db.insert(chatGroupMembers).values(userIds.map((userId) => ({ groupId, userId })));
  }

  async getChatGroupMembers(groupId: number): Promise<ChatGroupMemberType[]> {
    return db.select().from(chatGroupMembers).where(eq(chatGroupMembers.groupId, groupId));
  }

  async getChatMessages(groupId: number): Promise<ChatMessageType[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.groupId, groupId)).orderBy(desc(chatMessages.createdAt));
  }

  async createChatMessage(input: Omit<ChatMessageType, "id" | "createdAt">): Promise<ChatMessageType> {
    const [item] = await db.insert(chatMessages).values(input).returning();
    return item;
  }

  async removeAllChatGroupMembers(groupId: number): Promise<void> {
    await db.delete(chatGroupMembers).where(eq(chatGroupMembers.groupId, groupId));
  }

  async getChatGroup(groupId: number): Promise<ChatGroupType | undefined> {
    const [item] = await db.select().from(chatGroups).where(eq(chatGroups.id, groupId));
    return item;
  }

  async deleteChatGroup(groupId: number): Promise<boolean> {
    const [group] = await db.select().from(chatGroups).where(eq(chatGroups.id, groupId));
    if (!group) return false;
    await db.delete(chatMessages).where(eq(chatMessages.groupId, groupId));
    await db.delete(chatGroupMembers).where(eq(chatGroupMembers.groupId, groupId));
    const deleted = await db.delete(chatGroups).where(eq(chatGroups.id, groupId)).returning({ id: chatGroups.id });
    return deleted.length > 0;
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    const existing = await this.getAppSetting(key);
    if (existing === undefined) {
      await db.insert(appSettings).values({ key, value });
      return;
    }
    await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
  }

  async getAppSetting(key: string): Promise<string | undefined> {
    const [item] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return item?.value;
  }
}

export const storage = new DatabaseStorage();
