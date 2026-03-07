import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import crypto from "crypto";
import { sendAppointmentUpdateNotification, sendEmail, sendSms } from "./notifier";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const loyaltyPointsPerCompletedVisit = 10;
  const minimumBarberLockMinutes = 120;
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
  const defaultGoogleClientId = "519299194836-q7bvbn0jlonm6u47crap9lfhcg6835m0.apps.googleusercontent.com";

  function getGoogleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}${api.auth.googleCallback.path}`;
  }

  function getGoogleClientId() {
    return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || defaultGoogleClientId;
  }

  function getGoogleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  }

  async function createAndSendVerificationEmail(userId: number, email: string, firstName: string) {
    const token = crypto.randomBytes(32).toString("hex");
    await storage.createEmailVerificationToken({
      userId,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    const verifyUrl = `${appBaseUrl}/auth?verifyToken=${token}`;
    await sendEmail(
      email,
      "Verify your email",
      `Hi ${firstName}, verify your account by opening: ${verifyUrl}`,
    );
  }

  function getSlotKey(date: Date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isOverlapping(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
  }

  function normalizePhone(phone: string) {
    return phone.replace(/\D/g, "");
  }

  function parseNumericContent(content: string): number | null {
    const trimmed = content.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) return null;
    const val = Number.parseInt(trimmed, 10);
    return Number.isFinite(val) ? val : null;
  }

  function getSessionUserId(rawUserId: unknown): number | null {
    const numericUserId =
      typeof rawUserId === "number" ? rawUserId : Number.parseInt(String(rawUserId ?? ""), 10);
    return Number.isFinite(numericUserId) ? numericUserId : null;
  }

  async function seed() {
    let branchItems = await storage.getBranches();
    if (branchItems.length === 0) {
      await storage.createBranch({ name: "A", location: "Beşiktaş, Istanbul" });
      await storage.createBranch({ name: "B", location: "Kadıköy, Istanbul" });
      branchItems = await storage.getBranches();
    }

    const [firstBranch, secondBranch] = [branchItems[0], branchItems[1] ?? branchItems[0]];

    const adminUser = await storage.getUserByUsername("admin");
    if (!adminUser) {
      await storage.createUser({
        username: "admin",
        googleId: null,
        password: "admin",
        authProvider: "local",
        role: "admin",
        firstName: "Istanbul",
        lastName: "Admin",
        phone: "1234567890",
        email: "admin@istanbulsalon.com",
        emailVerified: true,
        loyaltyPoints: 0,
        branchId: firstBranch?.id ?? null,
        yearsOfExperience: null,
        bio: "Main system administrator",
        photoUrl: null,
        isAvailable: true,
        unavailableHours: "[]",
      });
    }

    const serviceItems = await storage.getServices();
    if (serviceItems.length === 0) {
      await storage.createService({ name: "Haircut", price: 20, durationMinutes: 30 });
      await storage.createService({ name: "Beard Trim", price: 15, durationMinutes: 20 });
      await storage.createService({ name: "Full Package (Hair + Beard)", price: 30, durationMinutes: 50 });
    }

    const appointmentItems = await storage.getAppointments();
    const existingBarbers = await storage.getBarbers();
    const firstBarber = existingBarbers[0];
    if (appointmentItems.length === 0 && firstBarber && firstBranch) {
      const services = await storage.getServices();
      const firstService = services[0];
      if (firstService) {
        await storage.createAppointment({
          clientId: null,
          guestFirstName: "Alice",
          guestLastName: "Johnson",
          guestPhone: "111222333",
          guestEmail: "alice@example.com",
          barberId: firstBarber.id,
          serviceId: firstService.id,
          branchId: firstBranch.id,
          appointmentDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
          status: "pending",
          proposedDate: null,
          proposedByRole: null,
          proposedStatus: "none",
          isDeleted: false,
        });
      }
    }
  }

  seed().catch(console.error);

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();
      const user = await storage.getUserByUsername(normalizedUsername);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.role === "client" && user.authProvider === "google") {
        return res.status(401).json({ message: "Use Google Sign-In for this account." });
      }
      if (user.role === "client" && user.email && !user.emailVerified) {
        return res.status(401).json({ message: "Please verify your email before login." });
      }

      const storedPassword = (user.password ?? "").trim();
      const isBcryptHash = storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$");
      const isValidPassword = isBcryptHash
        ? await compare(normalizedPassword, storedPassword)
        : storedPassword === normalizedPassword;

      if (!isValidPassword) return res.status(401).json({ message: "Invalid credentials" });

      req.session.userId = user.id;
      res.json(user);
    } catch (err: any) {
      console.error("[auth.login] failed", err);
      const message =
        process.env.NODE_ENV === "development"
          ? err?.message || "Bad Request"
          : "Bad Request";
      res.status(400).json({ message });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const hashedPassword = input.password ? await hash(input.password, 10) : null;
      const user = await storage.createUser({
        username: input.username ?? null,
        googleId: input.googleId ?? null,
        password: hashedPassword,
        authProvider: "local",
        role: "client",
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        emailVerified: input.email ? false : true,
        loyaltyPoints: input.loyaltyPoints ?? 0,
        branchId: input.branchId ?? null,
        yearsOfExperience: input.yearsOfExperience ?? null,
        bio: input.bio ?? null,
        photoUrl: input.photoUrl ?? null,
        isAvailable: true,
        unavailableHours: "[]",
      });
      if (user.email && !user.emailVerified) {
        await createAndSendVerificationEmail(user.id, user.email, user.firstName);
      }
      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.json(null);
    }

    const user = await storage.getUser(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json(null);
    }

    res.json(user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out" });
    });
  });

  app.get(api.auth.google.path, async (_req, res) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      return res.status(501).json({ message: "Google auth is not configured." });
    }

    const redirectUri = getGoogleRedirectUri();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    res.redirect(url.toString());
  });

  app.get(api.auth.googleCallback.path, async (req, res) => {
    try {
      const code = String(req.query.code ?? "");
      if (!code) return res.status(400).json({ message: "Missing code" });

      const clientId = getGoogleClientId();
      const clientSecret = getGoogleClientSecret();
      if (!clientId || !clientSecret) {
        return res.status(501).json({ message: "Google auth needs GOOGLE_CLIENT_SECRET in .env." });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: getGoogleRedirectUri(),
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenResponse.ok) return res.status(401).json({ message: "Google token exchange failed" });
      const tokenData = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenData.access_token) return res.status(401).json({ message: "Google access token missing" });

      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileResponse.ok) return res.status(401).json({ message: "Google profile fetch failed" });

      const profile = (await profileResponse.json()) as {
        sub: string;
        email?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      let user = await storage.getUserByGoogleId(profile.sub);
      if (!user && profile.email) user = await storage.getUserByEmail(profile.email);

      if (!user) {
        user = await storage.createUser({
          username: profile.email ? profile.email.split("@")[0] : null,
          googleId: profile.sub,
          password: null,
          authProvider: "google",
          role: "client",
          firstName: profile.given_name ?? "Google",
          lastName: profile.family_name ?? "User",
          phone: null,
          email: profile.email ?? null,
          emailVerified: true,
          loyaltyPoints: 0,
          branchId: null,
          yearsOfExperience: null,
          bio: null,
          photoUrl: profile.picture ?? null,
          isAvailable: true,
          unavailableHours: "[]",
        });
      } else {
        if (user.role !== "client") {
          return res.status(403).json({ message: "Google sign-in is only available for clients." });
        }
        user = await storage.updateUser(user.id, {
          googleId: user.googleId ?? profile.sub,
          authProvider: "google",
          emailVerified: true,
          photoUrl: user.photoUrl ?? profile.picture ?? null,
        });
      }

      req.session.userId = user.id;
      res.redirect("/?auth=google_success");
    } catch {
      res.status(400).json({ message: "Google sign-in failed." });
    }
  });

  app.get(api.auth.verifyEmail.path, async (req, res) => {
    const token = String(req.query.token ?? "");
    if (!token) return res.status(400).json({ ok: false, message: "Missing token." });

    const validToken = await storage.getValidEmailVerificationToken(token);
    if (!validToken) return res.status(400).json({ ok: false, message: "Invalid or expired verification token." });

    await storage.updateUser(validToken.userId, { emailVerified: true });
    await storage.markEmailVerificationTokenUsed(validToken.id);
    res.json({ ok: true, message: "Email verified successfully." });
  });

  app.post(api.auth.resendVerification.path, async (req, res) => {
    try {
      const { email } = api.auth.resendVerification.input.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !user.email) {
        return res.status(200).json({ ok: true, message: "If the email exists, a verification link was sent." });
      }
      if (user.emailVerified) return res.status(200).json({ ok: true, message: "Email is already verified." });
      await createAndSendVerificationEmail(user.id, user.email, user.firstName);
      return res.status(200).json({ ok: true, message: "Verification email sent." });
    } catch {
      return res.status(400).json({ ok: false, message: "Bad Request" });
    }
  });

  app.get(api.branches.list.path, async (_req, res) => {
    const branches = await storage.getBranches();
    res.json(branches);
  });

  app.post(api.branches.create.path, async (req, res) => {
    try {
      const input = api.branches.create.input.parse(req.body);
      const branch = await storage.createBranch(input);
      res.status(201).json(branch);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.branches.delete.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteBranch(id);
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Cannot delete branch in use by appointments or users." });
    }
  });

  app.get(api.services.list.path, async (_req, res) => {
    const serviceItems = await storage.getServices();
    res.json(serviceItems);
  });

  app.post(api.services.create.path, async (req, res) => {
    try {
      const input = api.services.create.input.parse(req.body);
      const service = await storage.createService(input);
      res.status(201).json(service);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.services.update.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const input = api.services.update.input.parse(req.body);
      const service = await storage.updateService(id, input);
      res.json(service);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.barbers.list.path, async (_req, res) => {
    const barbers = await storage.getBarbers();
    res.json(barbers);
  });

  app.post(api.barbers.create.path, async (req, res) => {
    try {
      const input = api.barbers.create.input.parse(req.body);
      const hashedPassword = input.password ? await hash(input.password, 10) : null;
      const barber = await storage.createUser({
        username: input.username ?? null,
        googleId: input.googleId ?? null,
        password: hashedPassword,
        authProvider: "local",
        role: "barber",
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        emailVerified: true,
        loyaltyPoints: input.loyaltyPoints ?? 0,
        branchId: input.branchId ?? null,
        yearsOfExperience: input.yearsOfExperience ?? null,
        bio: input.bio ?? null,
        photoUrl: input.photoUrl ?? null,
        isAvailable: true,
        unavailableHours: "[]",
      });
      res.status(201).json(barber);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.barbers.update.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const input = api.barbers.update.input.parse(req.body);
      const nextInput = { ...input } as any;
      if (typeof nextInput.password === "string" && nextInput.password.trim().length > 0) {
        nextInput.password = await hash(nextInput.password.trim(), 10);
      } else {
        delete nextInput.password;
      }
      const barber = await storage.updateUser(id, nextInput);
      res.json(barber);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.barbers.delete.path, async (req, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteBarber(id);
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Cannot delete barber with related data. Remove related appointments first." });
    }
  });

  app.get(api.appointments.list.path, async (_req, res) => {
    const appointmentItems = await storage.getAppointments();
    res.json(appointmentItems);
  });

  app.post(api.appointments.create.path, async (req, res) => {
    try {
      const numericClientId = req.body.clientId == null || req.body.clientId === "" ? undefined : Number(req.body.clientId);
      const numericBarberId = Number(req.body.barberId);
      const numericServiceId = Number(req.body.serviceId);
      const numericBranchId = Number(req.body.branchId);
      const input = api.appointments.create.input.parse({
        ...req.body,
        clientId: numericClientId,
        barberId: numericBarberId,
        serviceId: numericServiceId,
        branchId: numericBranchId,
        appointmentDate: new Date(req.body.appointmentDate),
      });
      if (!input.clientId && !input.guestPhone) {
        return res.status(400).json({ message: "Phone number is required for guest reservations." });
      }

      const allServices = await storage.getServices();
      const serviceById = new Map(allServices.map((s) => [Number(s.id), s]));
      const selectedService = serviceById.get(Number(input.serviceId));
      if (!selectedService) {
        return res.status(400).json({ message: "Invalid service." });
      }

      const barber = await storage.getUser(input.barberId);
      if (!barber || barber.role !== "barber") {
        return res.status(400).json({ message: "Invalid barber." });
      }
      if (barber.isAvailable === false) {
        return res.status(409).json({ message: "This barber is currently not available." });
      }

      const slotKey = getSlotKey(input.appointmentDate);
      const unavailableHours = (() => {
        try {
          const parsed = JSON.parse(barber.unavailableHours ?? "[]");
          return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
        } catch {
          return [];
        }
      })();
      if (unavailableHours.includes(slotKey)) {
        return res.status(409).json({ message: `Barber is not available at ${slotKey}.` });
      }

      const barberAppointments = await storage.getAppointmentsByBarber(input.barberId);
      const requestedStart = new Date(input.appointmentDate);
      const requestedLockMinutes = Math.max(selectedService.durationMinutes, minimumBarberLockMinutes);
      const requestedEnd = new Date(requestedStart.getTime() + requestedLockMinutes * 60 * 1000);
      const blockedStatuses = new Set(["pending", "accepted", "postponed"]);
      const overlappingAppointment = barberAppointments.find((a) => {
        if (!blockedStatuses.has(a.status)) return false;
        const existingService = serviceById.get(Number(a.serviceId));
        if (!existingService) return false;
        const existingStart =
          a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
            ? new Date(a.proposedDate)
            : new Date(a.appointmentDate);
        const existingLockMinutes = Math.max(existingService.durationMinutes, minimumBarberLockMinutes);
        const existingEnd = new Date(existingStart.getTime() + existingLockMinutes * 60 * 1000);
        return isOverlapping(existingStart, existingEnd, requestedStart, requestedEnd);
      });
      if (overlappingAppointment) {
        return res.status(409).json({
          message: "This barber is already reserved for at least 2 hours, or until the current cut is marked completed.",
        });
      }

      const clientUser = input.clientId ? await storage.getUser(input.clientId) : undefined;
      const appointment = await storage.createAppointment({
        clientId: input.clientId ?? null,
        guestFirstName: input.guestFirstName ?? clientUser?.firstName ?? null,
        guestLastName: input.guestLastName ?? clientUser?.lastName ?? null,
        guestPhone: input.guestPhone ? normalizePhone(input.guestPhone) : clientUser?.phone ? normalizePhone(clientUser.phone) : null,
        guestEmail: input.guestEmail ?? clientUser?.email ?? null,
        barberId: input.barberId,
        serviceId: input.serviceId,
        branchId: input.branchId,
        appointmentDate: input.appointmentDate,
        status: input.status ?? "pending",
        proposedDate: null,
        proposedByRole: null,
        proposedStatus: "none",
        isDeleted: false,
      });

      await storage.createNotification({
        userId: input.barberId,
        message: `New appointment requested by ${input.guestFirstName || clientUser?.firstName || "a client"} for ${new Date(input.appointmentDate).toLocaleString()}`,
        isRead: false,
      });

      res.status(201).json(appointment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.appointments.updateStatus.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { status, tipAmount, proposedDate } = api.appointments.updateStatus.input.parse(req.body);
      const appointmentBeforeUpdate = await storage.getAppointment(id);
      if (!appointmentBeforeUpdate) return res.status(404).json({ message: "Appointment not found" });

      let appointment = appointmentBeforeUpdate;
      const actorId = req.session.userId;
      const actor = actorId ? await storage.getUser(actorId) : undefined;
      const allServices = await storage.getServices();
      const serviceById = new Map(allServices.map((s) => [Number(s.id), s]));
      const currentService = serviceById.get(Number(appointmentBeforeUpdate.serviceId));
      const currentLockMinutes = Math.max(currentService?.durationMinutes ?? 30, minimumBarberLockMinutes);
      const barberAppointments = await storage.getAppointmentsByBarber(appointmentBeforeUpdate.barberId);
      const blockedStatuses = new Set(["pending", "accepted", "postponed"]);

      if (status === "postponed") {
        if (!proposedDate) return res.status(400).json({ message: "Please pick the new date/time." });
        const nextDate = new Date(proposedDate);
        if (Number.isNaN(nextDate.getTime())) return res.status(400).json({ message: "Invalid proposed date." });
        const nextEnd = new Date(nextDate.getTime() + currentLockMinutes * 60 * 1000);
        const conflict = barberAppointments.find((a) => {
          if (a.id === appointmentBeforeUpdate.id) return false;
          if (!blockedStatuses.has(a.status)) return false;
          const existingService = serviceById.get(Number(a.serviceId));
          if (!existingService) return false;
          const existingStart =
            a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
              ? new Date(a.proposedDate)
              : new Date(a.appointmentDate);
          const existingLockMinutes = Math.max(existingService.durationMinutes, minimumBarberLockMinutes);
          const existingEnd = new Date(existingStart.getTime() + existingLockMinutes * 60 * 1000);
          return isOverlapping(existingStart, existingEnd, nextDate, nextEnd);
        });
        if (conflict) {
          return res.status(409).json({ message: "The proposed postpone time overlaps with another active reservation for this barber." });
        }
        appointment = await storage.updateAppointment(id, {
          status: "postponed",
          proposedDate: nextDate,
          proposedByRole: actor?.role ?? "barber",
          proposedStatus: "pending_client",
        });
      } else {
        if (status === "accepted") {
          const nextStart = new Date(appointmentBeforeUpdate.appointmentDate);
          const nextEnd = new Date(nextStart.getTime() + currentLockMinutes * 60 * 1000);
          const conflict = barberAppointments.find((a) => {
            if (a.id === appointmentBeforeUpdate.id) return false;
            if (!blockedStatuses.has(a.status)) return false;
            const existingService = serviceById.get(Number(a.serviceId));
            if (!existingService) return false;
            const existingStart =
              a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
                ? new Date(a.proposedDate)
                : new Date(a.appointmentDate);
            const existingLockMinutes = Math.max(existingService.durationMinutes, minimumBarberLockMinutes);
            const existingEnd = new Date(existingStart.getTime() + existingLockMinutes * 60 * 1000);
            return isOverlapping(existingStart, existingEnd, nextStart, nextEnd);
          });
          if (conflict) {
            return res.status(409).json({ message: "Cannot accept this appointment because it overlaps another active reservation." });
          }
        }
        appointment = await storage.updateAppointment(id, {
          status,
          proposedStatus: status === "accepted" || status === "completed" ? "none" : appointmentBeforeUpdate.proposedStatus,
          proposedDate: status === "accepted" || status === "completed" ? null : appointmentBeforeUpdate.proposedDate,
          proposedByRole: status === "accepted" || status === "completed" ? null : appointmentBeforeUpdate.proposedByRole,
        });
      }

      const statusMessage =
        status === "postponed" && appointment.proposedDate
          ? `Your appointment was postponed to ${new Date(appointment.proposedDate).toLocaleString()}. Open check page to accept or request another time.`
          : `Your appointment on ${new Date(appointment.appointmentDate).toLocaleString()} is now ${status}.`;

      if (appointment.clientId) {
        await storage.createNotification({
          userId: appointment.clientId,
          message: statusMessage,
          isRead: false,
        });

        if (status === "completed") {
          await storage.updateUserLoyaltyPoints(appointment.clientId, loyaltyPointsPerCompletedVisit);
          await storage.createNotification({
            userId: appointment.clientId,
            message: `You earned ${loyaltyPointsPerCompletedVisit} loyalty points.`,
            isRead: false,
          });
        }
      }

      if (appointment.guestPhone) {
        await storage.createGuestNotification({
          guestPhone: appointment.guestPhone,
          appointmentId: appointment.id,
          message: statusMessage,
          isRead: false,
        });
      }

      if (status === "completed") {
        const existingEarning = await storage.getAppointmentEarningByAppointmentId(appointment.id);
        if (!existingEarning) {
          const service = await storage
            .getServices()
            .then((items) => items.find((s) => Number(s.id) === Number(appointment.serviceId)));
          const servicePrice = service?.price ?? 0;
          const safeTip = Math.max(0, Math.floor(tipAmount ?? 0));
          await storage.createAppointmentEarning({
            appointmentId: appointment.id,
            barberId: appointment.barberId,
            branchId: appointment.branchId,
            servicePrice,
            tipAmount: safeTip,
            totalAmount: servicePrice + safeTip,
          });
        }
      }

      const appointmentClient = appointment.clientId ? await storage.getUser(appointment.clientId) : undefined;
      const notifyEmail = appointment.guestEmail ?? appointmentBeforeUpdate?.guestEmail ?? appointmentClient?.email ?? null;
      const notifyPhone = appointment.guestPhone ?? appointmentBeforeUpdate?.guestPhone ?? appointmentClient?.phone ?? null;

      if (notifyPhone || notifyEmail) {
        await sendAppointmentUpdateNotification({
          email: notifyEmail,
          phone: notifyPhone,
          subject: "Appointment status update",
          message: statusMessage,
        });
      }

      res.json(appointment);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.appointments.guestByPhone.path, async (req, res) => {
    const phone = normalizePhone(String(req.query.phone ?? "").trim());
    if (!phone) return res.status(400).json({ message: "Phone is required" });
    const items = await storage.getAppointmentsByGuestPhone(phone);
    res.json(items);
  });

  app.patch(api.appointments.respondProposedTime.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { action } = api.appointments.respondProposedTime.input.parse(req.body);
      const appointment = await storage.getAppointment(id);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });
      if (appointment.status !== "postponed" || appointment.proposedStatus !== "pending_client" || !appointment.proposedDate) {
        return res.status(400).json({ message: "No pending proposed time for this appointment." });
      }

      if (action === "accept") {
        const allServices = await storage.getServices();
        const serviceById = new Map(allServices.map((s) => [Number(s.id), s]));
        const thisService = serviceById.get(Number(appointment.serviceId));
        const lockMinutes = Math.max(thisService?.durationMinutes ?? 30, minimumBarberLockMinutes);
        const nextStart = new Date(appointment.proposedDate);
        const nextEnd = new Date(nextStart.getTime() + lockMinutes * 60 * 1000);
        const blockedStatuses = new Set(["pending", "accepted", "postponed"]);
        const barberAppointments = await storage.getAppointmentsByBarber(appointment.barberId);
        const conflict = barberAppointments.find((a) => {
          if (a.id === appointment.id) return false;
          if (!blockedStatuses.has(a.status)) return false;
          const existingService = serviceById.get(Number(a.serviceId));
          if (!existingService) return false;
          const existingStart =
            a.status === "postponed" && a.proposedStatus === "pending_client" && a.proposedDate
              ? new Date(a.proposedDate)
              : new Date(a.appointmentDate);
          const existingLockMinutes = Math.max(existingService.durationMinutes, minimumBarberLockMinutes);
          const existingEnd = new Date(existingStart.getTime() + existingLockMinutes * 60 * 1000);
          return isOverlapping(existingStart, existingEnd, nextStart, nextEnd);
        });
        if (conflict) {
          return res.status(409).json({ message: "Cannot accept this time because it overlaps another active reservation." });
        }
      }

      const updated =
        action === "accept"
          ? await storage.updateAppointment(id, {
              status: "accepted",
              appointmentDate: appointment.proposedDate,
              proposedStatus: "accepted",
              proposedDate: null,
              proposedByRole: null,
            })
          : await storage.updateAppointment(id, {
              proposedStatus: "declined",
            });

      await storage.createNotification({
        userId: appointment.barberId,
        message:
          action === "accept"
            ? `Client accepted new time for appointment #${appointment.id}.`
            : `Client declined proposed time for appointment #${appointment.id}.`,
        isRead: false,
      });

      if (appointment.guestPhone) {
        await storage.createGuestNotification({
          guestPhone: appointment.guestPhone,
          appointmentId: appointment.id,
          message:
            action === "accept"
              ? `You accepted the new time for appointment #${appointment.id}.`
              : `You declined the new time for appointment #${appointment.id}.`,
          isRead: false,
        });
      }

      res.json(updated);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.feedbacks.list.path, async (_req, res) => {
    const feedbackItems = await storage.getFeedbacks();
    res.json(feedbackItems);
  });

  app.post(api.feedbacks.create.path, async (req, res) => {
    try {
      const input = api.feedbacks.create.input.parse(req.body);
      const feedback = await storage.createFeedback({
        appointmentId: input.appointmentId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        rating: input.rating,
        comment: input.comment ?? null,
      });
      res.status(201).json(feedback);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.notifications.list.path, async (req, res) => {
    const userIdFromSession = req.session.userId;
    const userId = userIdFromSession ?? (req.query.userId ? Number.parseInt(req.query.userId as string, 10) : NaN);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ message: "Not logged in" });
    }
    const notificationItems = await storage.getNotifications(userId);
    res.json(notificationItems);
  });

  app.patch(api.notifications.markRead.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const notification = await storage.markNotificationRead(id);
      res.json(notification);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.notifications.markAllRead.path, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const ok = await storage.markAllNotificationsRead(userId);
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.admin.sendMessage.path, async (req, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const input = api.admin.sendMessage.input.parse(req.body);
      const appointment = await storage.getAppointment(input.appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });

      const client = appointment.clientId ? await storage.getUser(appointment.clientId) : undefined;
      const toEmail = appointment.guestEmail ?? client?.email ?? null;
      const toPhone = appointment.guestPhone ?? client?.phone ?? null;

      const [emailResult, smsResult] = await Promise.all([
        toEmail ? sendEmail(toEmail, "Message from salon admin", input.message) : Promise.resolve({ sent: false, provider: "none" }),
        toPhone ? sendSms(toPhone, input.message) : Promise.resolve({ sent: false, provider: "none" }),
      ]);

      if (appointment.clientId) {
        await storage.createNotification({
          userId: appointment.clientId,
          message: `Admin message: ${input.message}`,
          isRead: false,
        });
      }

      if (appointment.guestPhone) {
        await storage.createGuestNotification({
          guestPhone: appointment.guestPhone,
          appointmentId: appointment.id,
          message: `Admin message: ${input.message}`,
          isRead: false,
        });
      }

      const saved = await storage.createAdminMessage({
        appointmentId: appointment.id,
        adminUserId: admin.id,
        toEmail,
        toPhone,
        message: input.message,
        sentViaEmail: emailResult.sent,
        sentViaSms: smsResult.sent,
      });

      res.status(201).json(saved);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.admin.deleteAppointments.path, async (req, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const { ids } = api.admin.deleteAppointments.input.parse(req.body);
      const deleted = await storage.deleteAppointmentsByIds(ids);
      res.json({ ok: true, deleted });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.admin.settings.path, async (req, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const input = api.admin.settings.input.parse(req.body);
      if (input.wallDisplayBackground) await storage.setAppSetting("wall_display_background", input.wallDisplayBackground);
      if (input.notificationSound) await storage.setAppSetting("notification_sound", input.notificationSound);
      if (typeof input.wallShowWeather === "boolean") await storage.setAppSetting("wall_show_weather", input.wallShowWeather ? "1" : "0");
      if (typeof input.wallShowMusic === "boolean") await storage.setAppSetting("wall_show_music", input.wallShowMusic ? "1" : "0");
      if (typeof input.wallQueueLimit === "number") await storage.setAppSetting("wall_queue_limit", String(input.wallQueueLimit));
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.earnings.summary.path, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not logged in" });

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const barberDailyTotal = user.role === "barber" ? await storage.getDailyBarberEarnings(user.id, start, end) : 0;

      let branchDailyTotal = 0;
      const branchItems = await storage.getBranches();
      const barbers = await storage.getBarbers();
      const branchTotals = await Promise.all(
        branchItems.map(async (b) => ({ branchId: b.id, branchName: b.name, total: await storage.getDailyBranchEarnings(b.id, start, end) })),
      );
      const barberTotals = await Promise.all(
        barbers.map(async (b) => ({
          barberId: b.id,
          barberName: `${b.firstName} ${b.lastName}`,
          total: await storage.getDailyBarberEarnings(b.id, start, end),
        })),
      );
      const totalProfit = branchTotals.reduce((s, b) => s + b.total, 0);
      const expenseItems = await storage.getExpenses();
      const totalExpenses = expenseItems
        .filter((e) => e.createdAt && e.createdAt >= start && e.createdAt < end)
        .reduce((s, e) => s + e.amount, 0);
      const netProfit = totalProfit - totalExpenses;

      if (user.role === "admin") {
        branchDailyTotal = totalProfit;
      } else if (user.branchId) {
        branchDailyTotal = await storage.getDailyBranchEarnings(user.branchId, start, end);
      }

      res.json({ barberDailyTotal, branchDailyTotal, totalProfit, totalExpenses, netProfit, branchTotals, barberTotals });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.guestNotifications.list.path, async (req, res) => {
    const phone = normalizePhone(String(req.query.phone ?? "").trim());
    if (!phone) return res.status(400).json({ message: "Phone is required" });
    const items = await storage.getGuestNotificationsByPhone(phone);
    res.json(items);
  });

  app.patch(api.guestNotifications.markRead.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const item = await storage.markGuestNotificationRead(id);
      res.json(item);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.expenses.list.path, async (_req, res) => {
    const items = await storage.getExpenses();
    res.json(items);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const input = api.expenses.create.input.parse(req.body);
      const item = await storage.createExpense({
        title: input.title,
        amount: input.amount,
        branchId: input.branchId ?? null,
        createdByUserId: user.id,
      });
      res.status(201).json(item);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.expenses.update.path, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = Number.parseInt(req.params.id, 10);
      const input = api.expenses.update.input.parse(req.body);
      const item = await storage.updateExpense(id, {
        ...(input.title != null ? { title: input.title } : {}),
        ...(input.amount != null ? { amount: input.amount } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      });
      if (!item) return res.status(404).json({ message: "Expense not found" });
      res.json(item);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteExpense(id);
      if (!ok) return res.status(404).json({ message: "Expense not found" });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.chat.groups.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const groups =
      user.role === "admin" || user.role === "barber"
        ? await storage.getChatGroups()
        : await storage.getChatGroupsForUser(userId);
    res.json(groups);
  });

  app.post(api.chat.createGroup.path, async (req, res) => {
    try {
      const adminId = getSessionUserId(req.session.userId);
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const input = api.chat.createGroup.input.parse(req.body);
      const group = await storage.createChatGroup({
        name: input.name,
        mode: input.mode,
        createdByUserId: admin.id,
      });
      const members = Array.from(new Set([admin.id, ...input.memberIds]));
      await storage.addChatGroupMembers(group.id, members);
      res.status(201).json(group);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.chat.deleteGroup.path, async (req, res) => {
    try {
      const adminId = getSessionUserId(req.session.userId);
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const groupId = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteChatGroup(groupId);
      if (!ok) return res.status(404).json({ message: "Group not found" });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.chat.messages.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const groupId = Number.parseInt(req.params.id, 10);
    let members = await storage.getChatGroupMembers(groupId);
    if (!members.some((m) => m.userId === userId)) {
      const user = await storage.getUser(userId);
      if (!user || !["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      await storage.addChatGroupMembers(groupId, [userId]);
      members = await storage.getChatGroupMembers(groupId);
      if (!members.some((m) => m.userId === userId)) return res.status(403).json({ message: "Forbidden" });
    }
    const messages = await storage.getChatMessages(groupId);
    const withSender = await Promise.all(
      messages.reverse().map(async (m) => {
        const u = await storage.getUser(m.userId);
        return {
          ...m,
          senderRole: u?.role ?? "unknown",
          senderName: u ? `${u.firstName} ${u.lastName}` : `User #${m.userId}`,
        };
      }),
    );
    res.json(withSender);
  });

  app.post(api.chat.sendMessage.path, async (req, res) => {
    try {
      const userId = getSessionUserId(req.session.userId);
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const groupId = Number.parseInt(req.params.id, 10);
      let members = await storage.getChatGroupMembers(groupId);
      if (!members.some((m) => m.userId === userId)) {
        const user = await storage.getUser(userId);
        if (!user || !["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
        await storage.addChatGroupMembers(groupId, [userId]);
        members = await storage.getChatGroupMembers(groupId);
        if (!members.some((m) => m.userId === userId)) return res.status(403).json({ message: "Forbidden" });
      }
      const group = await storage.getChatGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const { content } = api.chat.sendMessage.input.parse(req.body);
      let numericValue: number | null = null;
      if (group.mode === "numbers_only") {
        numericValue = parseNumericContent(content);
        if (numericValue === null) return res.status(400).json({ message: "This group accepts numbers only like +20 or -5." });
      }
      const msg = await storage.createChatMessage({ groupId, userId, content, numericValue });
      res.status(201).json(msg);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.chat.updateMembers.path, async (req, res) => {
    try {
      const adminId = getSessionUserId(req.session.userId);
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const groupId = Number.parseInt(req.params.id, 10);
      const group = await storage.getChatGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const { memberIds } = api.chat.updateMembers.input.parse(req.body);
      await storage.removeAllChatGroupMembers(groupId);
      const members = Array.from(new Set([admin.id, ...memberIds]));
      await storage.addChatGroupMembers(groupId, members);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.chat.members.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const groupId = Number.parseInt(req.params.id, 10);
    let members = await storage.getChatGroupMembers(groupId);
    if (!members.some((m) => m.userId === userId)) {
      const user = await storage.getUser(userId);
      if (!user || !["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      await storage.addChatGroupMembers(groupId, [userId]);
      members = await storage.getChatGroupMembers(groupId);
      if (!members.some((m) => m.userId === userId)) return res.status(403).json({ message: "Forbidden" });
    }
    res.json(members.map((m) => ({ userId: m.userId })));
  });

  app.get(api.chat.totals.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const groupId = Number.parseInt(req.params.id, 10);
    let members = await storage.getChatGroupMembers(groupId);
    if (!members.some((m) => m.userId === userId)) {
      const user = await storage.getUser(userId);
      if (!user || !["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      await storage.addChatGroupMembers(groupId, [userId]);
      members = await storage.getChatGroupMembers(groupId);
      if (!members.some((m) => m.userId === userId)) return res.status(403).json({ message: "Forbidden" });
    }
    const messages = await storage.getChatMessages(groupId);
    const byUserMap = new Map<number, number>();
    let groupTotal = 0;
    for (const m of messages) {
      const val = m.numericValue ?? 0;
      groupTotal += val;
      byUserMap.set(m.userId, (byUserMap.get(m.userId) ?? 0) + val);
    }
    const byUser = Array.from(byUserMap.entries()).map(([uid, total]) => ({ userId: uid, total }));
    res.json({ groupTotal, byUser });
  });

  app.get(api.settings.public.path, async (_req, res) => {
    const wallDisplayBackground =
      (await storage.getAppSetting("wall_display_background")) ||
      "https://www.baltana.com/files/wallpapers-29/Istanbul-Wallpaper-95987.jpg";
    const notificationSound =
      ((await storage.getAppSetting("notification_sound")) as "chime" | "beep" | "ding" | undefined) || "chime";
    const wallShowWeather = (await storage.getAppSetting("wall_show_weather")) !== "0";
    const wallShowMusic = (await storage.getAppSetting("wall_show_music")) !== "0";
    const wallQueueLimit = Number.parseInt((await storage.getAppSetting("wall_queue_limit")) || "6", 10);
    res.json({ wallDisplayBackground, notificationSound, wallShowWeather, wallShowMusic, wallQueueLimit: Number.isFinite(wallQueueLimit) ? wallQueueLimit : 6 });
  });

  return httpServer;
}

