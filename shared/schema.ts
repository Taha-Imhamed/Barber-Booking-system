import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  googleId: text("google_id").unique(),
  password: text("password"),
  authProvider: text("auth_provider").notNull().default("local"),
  role: text("role").notNull().default("client"), // admin | barber | client
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false),
  loyaltyPoints: integer("loyalty_points").default(0),
  branchId: integer("branch_id").references(() => branches.id),
  yearsOfExperience: integer("years_of_experience"),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  instagramUrl: text("instagram_url"),
  isAvailable: boolean("is_available").default(true),
  unavailableHours: text("unavailable_hours").default("[]"),
  noShowCount: integer("no_show_count").default(0),
  isFlaggedNoShow: boolean("is_flagged_no_show").default(false),
  bookingCreditCents: integer("booking_credit_cents").default(0),
  adminPermissions: text("admin_permissions").default("[]"),
  isDeleted: boolean("is_deleted").default(false),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  isDeleted: boolean("is_deleted").default(false),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => users.id),
  guestFirstName: text("guest_first_name"),
  guestLastName: text("guest_last_name"),
  guestPhone: text("guest_phone"),
  guestEmail: text("guest_email"),
  barberId: integer("barber_id").references(() => users.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  appointmentDate: timestamp("appointment_date").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected | postponed | completed | no_show | cancelled
  proposedDate: timestamp("proposed_date"),
  proposedByRole: text("proposed_by_role"),
  proposedStatus: text("proposed_status").default("none"),
  paymentMethod: text("payment_method").notNull().default("cash_on_arrival"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  prepaidAmount: integer("prepaid_amount").notNull().default(0),
  paymentReference: text("payment_reference"),
  totalDurationMinutes: integer("total_duration_minutes"),
  totalPrice: integer("total_price"),
  cancelledAt: timestamp("cancelled_at"),
  noShowMarkedAt: timestamp("no_show_marked_at"),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointmentServices = pgTable("appointment_services", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  price: integer("price").notNull(),
});

export const feedbacks = pgTable("feedbacks", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => users.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminMessages = pgTable("admin_messages", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  adminUserId: integer("admin_user_id").references(() => users.id).notNull(),
  toEmail: text("to_email"),
  toPhone: text("to_phone"),
  message: text("message").notNull(),
  sentViaEmail: boolean("sent_via_email").default(false),
  sentViaSms: boolean("sent_via_sms").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointmentEarnings = pgTable("appointment_earnings", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull().unique(),
  barberId: integer("barber_id").references(() => users.id).notNull(),
  branchId: integer("branch_id").references(() => branches.id).notNull(),
  servicePrice: integer("service_price").notNull(),
  tipAmount: integer("tip_amount").default(0),
  totalAmount: integer("total_amount").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

export const guestNotifications = pgTable("guest_notifications", {
  id: serial("id").primaryKey(),
  guestPhone: text("guest_phone").notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointmentReminders = pgTable("appointment_reminders", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  reminderType: text("reminder_type").notNull(), // 24h | 1h
  channel: text("channel").notNull().default("email"), // email | sms
  sentAt: timestamp("sent_at").defaultNow(),
});

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  date: timestamp("date").notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  amount: integer("amount").notNull(),
  branchId: integer("branch_id").references(() => branches.id),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  price: integer("price").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const inventorySales = pgTable("inventory_sales", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").references(() => inventory.id).notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: integer("total_amount").notNull(),
  soldByUserId: integer("sold_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatGroups = pgTable("chat_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("text_numbers"),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatGroupMembers = pgTable("chat_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => chatGroups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => chatGroups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  numericValue: integer("numeric_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => users.id).notNull(),
  referredUserId: integer("referred_user_id").references(() => users.id).notNull(),
  rewardGiven: boolean("reward_given").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const barberGallery = pgTable("barber_gallery", {
  id: serial("id").primaryKey(),
  barberId: integer("barber_id").references(() => users.id).notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: text("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const customerTags = pgTable("customer_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userTags = pgTable("user_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tagId: integer("tag_id").references(() => customerTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  sentByUserId: integer("sent_by_user_id").references(() => users.id).notNull(),
  channel: text("channel").notNull().default("email"),
  targetTagId: integer("target_tag_id").references(() => customerTags.id),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertAppointmentServiceSchema = createInsertSchema(appointmentServices).omit({ id: true });
export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({ id: true, createdAt: true });
export const insertAdminMessageSchema = createInsertSchema(adminMessages).omit({ id: true, createdAt: true });
export const insertAppointmentEarningSchema = createInsertSchema(appointmentEarnings).omit({ id: true, earnedAt: true });
export const insertGuestNotificationSchema = createInsertSchema(guestNotifications).omit({ id: true, createdAt: true });
export const insertAppointmentReminderSchema = createInsertSchema(appointmentReminders).omit({ id: true, sentAt: true });
export const insertWaitlistSchema = createInsertSchema(waitlist).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, lastUpdated: true });
export const insertInventorySaleSchema = createInsertSchema(inventorySales).omit({ id: true, createdAt: true });
export const insertChatGroupSchema = createInsertSchema(chatGroups).omit({ id: true, createdAt: true });
export const insertChatGroupMemberSchema = createInsertSchema(chatGroupMembers).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertAppSettingSchema = createInsertSchema(appSettings).omit({ id: true });
export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({ id: true, createdAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export const insertBarberGallerySchema = createInsertSchema(barberGallery).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertCustomerTagSchema = createInsertSchema(customerTags).omit({ id: true, createdAt: true });
export const insertUserTagSchema = createInsertSchema(userTags).omit({ id: true, createdAt: true });
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({ id: true, sentAt: true });

export type UserType = typeof users.$inferSelect;
export type BranchType = typeof branches.$inferSelect;
export type ServiceType = typeof services.$inferSelect;
export type AppointmentType = typeof appointments.$inferSelect;
export type AppointmentServiceType = typeof appointmentServices.$inferSelect;
export type FeedbackType = typeof feedbacks.$inferSelect;
export type ReviewType = typeof reviews.$inferSelect;
export type NotificationType = typeof notifications.$inferSelect;
export type EmailVerificationTokenType = typeof emailVerificationTokens.$inferSelect;
export type AdminMessageType = typeof adminMessages.$inferSelect;
export type AppointmentEarningType = typeof appointmentEarnings.$inferSelect;
export type GuestNotificationType = typeof guestNotifications.$inferSelect;
export type AppointmentReminderType = typeof appointmentReminders.$inferSelect;
export type WaitlistType = typeof waitlist.$inferSelect;
export type ExpenseType = typeof expenses.$inferSelect;
export type InventoryType = typeof inventory.$inferSelect;
export type InventorySaleType = typeof inventorySales.$inferSelect;
export type ChatGroupType = typeof chatGroups.$inferSelect;
export type ChatGroupMemberType = typeof chatGroupMembers.$inferSelect;
export type ChatMessageType = typeof chatMessages.$inferSelect;
export type AppSettingType = typeof appSettings.$inferSelect;
export type ReferralCodeType = typeof referralCodes.$inferSelect;
export type ReferralType = typeof referrals.$inferSelect;
export type BarberGalleryType = typeof barberGallery.$inferSelect;
export type AuditLogType = typeof auditLogs.$inferSelect;
export type CustomerTagType = typeof customerTags.$inferSelect;
export type UserTagType = typeof userTags.$inferSelect;
export type MarketingCampaignType = typeof marketingCampaigns.$inferSelect;

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
