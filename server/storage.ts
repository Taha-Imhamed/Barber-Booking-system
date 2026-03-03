import { db } from "./db";
import {
  users,
  branches,
  services,
  appointments,
  feedbacks,
  notifications,
  type UserType,
  type BranchType,
  type ServiceType,
  type AppointmentType,
  type FeedbackType,
  type NotificationType
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

export interface IStorage {
  // Users (Auth & Barbers)
  getUser(id: number): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  createUser(user: Omit<UserType, "id">): Promise<UserType>;
  getBarbers(): Promise<UserType[]>;
  
  // Branches
  getBranches(): Promise<BranchType[]>;
  createBranch(branch: Omit<BranchType, "id">): Promise<BranchType>;
  
  // Services
  getServices(): Promise<ServiceType[]>;
  createService(service: Omit<ServiceType, "id">): Promise<ServiceType>;
  
  // Appointments
  getAppointments(): Promise<AppointmentType[]>;
  getAppointmentsByBarber(barberId: number): Promise<AppointmentType[]>;
  createAppointment(appointment: Omit<AppointmentType, "id" | "createdAt">): Promise<AppointmentType>;
  updateAppointmentStatus(id: number, status: string): Promise<AppointmentType>;
  
  // Feedbacks
  getFeedbacks(): Promise<FeedbackType[]>;
  createFeedback(feedback: Omit<FeedbackType, "id" | "createdAt">): Promise<FeedbackType>;
  
  // Notifications
  getNotifications(userId: number): Promise<NotificationType[]>;
  createNotification(notification: Omit<NotificationType, "id" | "createdAt">): Promise<NotificationType>;
  markNotificationRead(id: number): Promise<NotificationType>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<UserType | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<UserType | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(user: Omit<UserType, "id">): Promise<UserType> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  async getBarbers(): Promise<UserType[]> {
    return await db.select().from(users).where(eq(users.role, 'barber'));
  }
  
  // Branches
  async getBranches(): Promise<BranchType[]> {
    return await db.select().from(branches);
  }
  
  async createBranch(branch: Omit<BranchType, "id">): Promise<BranchType> {
    const [newBranch] = await db.insert(branches).values(branch).returning();
    return newBranch;
  }
  
  // Services
  async getServices(): Promise<ServiceType[]> {
    return await db.select().from(services);
  }
  
  async createService(service: Omit<ServiceType, "id">): Promise<ServiceType> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }
  
  // Appointments
  async getAppointments(): Promise<AppointmentType[]> {
    return await db.select().from(appointments).orderBy(desc(appointments.appointmentDate));
  }
  
  async getAppointmentsByBarber(barberId: number): Promise<AppointmentType[]> {
    return await db.select().from(appointments).where(eq(appointments.barberId, barberId)).orderBy(desc(appointments.appointmentDate));
  }
  
  async createAppointment(appointment: Omit<AppointmentType, "id" | "createdAt">): Promise<AppointmentType> {
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
}

export const storage = new DatabaseStorage();
