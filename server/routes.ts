import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed Database with initial data
  async function seed() {
    const branches = await storage.getBranches();
    if (branches.length === 0) {
      const b1 = await storage.createBranch({ name: "Wilson", location: "Wilson Square" });
      const b2 = await storage.createBranch({ name: "Kavaja", location: "Kavaja Street" });
      
      const admin = await storage.createUser({
        username: "admin",
        password: "admin", // User requested admin/admin
        role: "admin",
        firstName: "Super",
        lastName: "Admin",
        phone: "1234567890",
        email: "admin@barber.com",
        loyaltyPoints: 0,
        branchId: b1.id,
        yearsOfExperience: null,
        bio: null,
        photoUrl: null
      });

      const barber1 = await storage.createUser({
        username: "barber1",
        password: "password123",
        role: "barber",
        firstName: "John",
        lastName: "Doe",
        phone: "1234567891",
        email: "john@barber.com",
        loyaltyPoints: 0,
        branchId: b1.id,
        yearsOfExperience: 5,
        bio: "Master of fades and clean cuts.",
        photoUrl: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&q=80"
      });

      const barber2 = await storage.createUser({
        username: "barber2",
        password: "password123",
        role: "barber",
        firstName: "Mike",
        lastName: "Smith",
        phone: "1234567892",
        email: "mike@barber.com",
        loyaltyPoints: 0,
        branchId: b2.id,
        yearsOfExperience: 8,
        bio: "Specialist in classic styles.",
        photoUrl: "https://images.unsplash.com/photo-1593702288056-ccbfb2b1a13b?w=400&q=80"
      });

      const s1 = await storage.createService({ name: "Haircut", price: 20, durationMinutes: 30 });
      const s2 = await storage.createService({ name: "Beard Trim", price: 15, durationMinutes: 20 });
      const s3 = await storage.createService({ name: "Full Package (Hair + Beard)", price: 30, durationMinutes: 50 });
      
      await storage.createAppointment({
        clientId: null,
        guestFirstName: "Alice",
        guestLastName: "Johnson",
        guestPhone: "111222333",
        guestEmail: "alice@example.com",
        barberId: barber1.id,
        serviceId: s1.id,
        branchId: b1.id,
        appointmentDate: new Date(Date.now() + 1000 * 60 * 60 * 24), // Tomorrow
        status: "pending"
      });
    }
  }

  seed().catch(console.error);

  // AUTH (Mock)
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.auth.me.path, (req, res) => {
    // In a real app we'd use sessions/tokens. Mock returning 401 for now.
    res.status(401).json({ message: "Not logged in" });
  });

  // BRANCHES
  app.get(api.branches.list.path, async (req, res) => {
    const branches = await storage.getBranches();
    res.json(branches);
  });

  // SERVICES
  app.get(api.services.list.path, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.post(api.services.create.path, async (req, res) => {
    try {
      const input = api.services.create.input.parse(req.body);
      const service = await storage.createService(input);
      res.status(201).json(service);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  // BARBERS
  app.get(api.barbers.list.path, async (req, res) => {
    const barbers = await storage.getBarbers();
    res.json(barbers);
  });

  app.post(api.barbers.create.path, async (req, res) => {
    try {
      const input = api.barbers.create.input.parse(req.body);
      const barber = await storage.createUser({ ...input, role: "barber" });
      res.status(201).json(barber);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  // APPOINTMENTS
  app.get(api.appointments.list.path, async (req, res) => {
    const appointments = await storage.getAppointments();
    res.json(appointments);
  });

  app.post(api.appointments.create.path, async (req, res) => {
    try {
      const input = api.appointments.create.input.parse({
        ...req.body,
        appointmentDate: new Date(req.body.appointmentDate) // Coerce to Date
      });
      const appointment = await storage.createAppointment(input);
      
      // Create a notification for the barber
      await storage.createNotification({
        userId: input.barberId,
        message: `New appointment requested by ${input.guestFirstName || 'a client'} for ${new Date(input.appointmentDate).toLocaleString()}`,
        isRead: false
      });
      
      res.status(201).json(appointment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.appointments.updateStatus.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = api.appointments.updateStatus.input.parse(req.body);
      const appointment = await storage.updateAppointmentStatus(id, status);
      res.json(appointment);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  // FEEDBACKS
  app.get(api.feedbacks.list.path, async (req, res) => {
    const feedbacks = await storage.getFeedbacks();
    res.json(feedbacks);
  });

  app.post(api.feedbacks.create.path, async (req, res) => {
    try {
      const input = api.feedbacks.create.input.parse(req.body);
      const feedback = await storage.createFeedback(input);
      res.status(201).json(feedback);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  // NOTIFICATIONS
  app.get(api.notifications.list.path, async (req, res) => {
    // In a real app we'd get userId from session. 
    // Just mock returning all for simplicity or pass userId in query
    const userId = req.query.userId ? parseInt(req.query.userId as string) : 1; 
    const notifications = await storage.getNotifications(userId);
    res.json(notifications);
  });

  app.patch(api.notifications.markRead.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationRead(id);
      res.json(notification);
    } catch (err) {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  return httpServer;
}
