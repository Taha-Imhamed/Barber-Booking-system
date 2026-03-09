import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import crypto from "crypto";
import { sendAppointmentUpdateNotification, sendEmail, sendSms } from "./notifier";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  type AuditLogItem = {
    id: number;
    timestamp: string;
    event: "api_call" | "login_success" | "login_failed" | "logout";
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId: number | null;
    ip: string | null;
    userAgent: string | null;
    details?: Record<string, unknown>;
  };
  const auditLogs: AuditLogItem[] = [];
  const maxAuditLogItems = 5000;
  let auditSeq = 1;

  const loyaltyPointsPerCompletedVisit = 10;
  const minimumBarberLockMinutes = 120;
  const salonPhone = process.env.SALON_PHONE || "692057984";
  const salonAddress = process.env.SALON_ADDRESS || "Istanbul";
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
  const payseraTestBaseUrl = process.env.PAYSERA_TEST_CHECKOUT_URL || "https://sandbox.paysera.com/mock-checkout";
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
    const emailResult = await sendEmail(
      email,
      "Verify your email",
      `Hi ${firstName}, verify your account by opening: ${verifyUrl}`,
    );
    if (!emailResult.sent) {
      console.warn("[auth.verify-email] failed", {
        email,
        provider: emailResult.provider,
        error: emailResult.error,
      });
    }
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

  function makePaymentReference(appointmentId: number): string {
    const seed = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `PAYSERA-TEST-${appointmentId}-${seed}`;
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

  function pushAuditLog(item: Omit<AuditLogItem, "id" | "timestamp">) {
    const entry: AuditLogItem = {
      id: auditSeq++,
      timestamp: new Date().toISOString(),
      ...item,
    };
    auditLogs.push(entry);
    if (auditLogs.length > maxAuditLogItems) {
      auditLogs.splice(0, auditLogs.length - maxAuditLogItems);
    }
  }

  function extractRoutes(obj: unknown, out: { method: string; path: string }[] = []): { method: string; path: string }[] {
    if (!obj || typeof obj !== "object") return out;
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (
        value &&
        typeof value === "object" &&
        "method" in (value as Record<string, unknown>) &&
        "path" in (value as Record<string, unknown>)
      ) {
        const route = value as { method?: string; path?: string };
        if (route.method && route.path) out.push({ method: route.method, path: route.path });
      } else {
        extractRoutes(value, out);
      }
    }
    return out;
  }

  async function requireAdmin(req: any, res: any) {
    const userId = getSessionUserId(req.session?.userId);
    if (!userId) {
      res.status(401).json({ message: "Not logged in" });
      return null;
    }
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({ message: "Admin only" });
      return null;
    }
    return user;
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
          paymentMethod: "cash_on_arrival",
          paymentStatus: "unpaid",
          prepaidAmount: 0,
          paymentReference: null,
          isDeleted: false,
        });
      }
    }
  }

  seed().catch(console.error);

  app.use("/api", (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      pushAuditLog({
        event: "api_call",
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: getSessionUserId(req.session?.userId),
        ip: req.ip ?? null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
    });
    next();
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { username, password } = api.auth.login.input.parse(req.body);
      const normalizedUsername = username.trim();
      const normalizedPassword = password.trim();
      const user = await storage.getUserByUsername(normalizedUsername);
      if (!user) {
        pushAuditLog({
          event: "login_failed",
          method: req.method,
          path: req.path,
          statusCode: 401,
          durationMs: 0,
          userId: null,
          ip: req.ip ?? null,
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
          details: { username: normalizedUsername, reason: "user_not_found" },
        });
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

      if (!isValidPassword) {
        pushAuditLog({
          event: "login_failed",
          method: req.method,
          path: req.path,
          statusCode: 401,
          durationMs: 0,
          userId: user.id,
          ip: req.ip ?? null,
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
          details: { username: normalizedUsername, reason: "invalid_password" },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      pushAuditLog({
        event: "login_success",
        method: req.method,
        path: req.path,
        statusCode: 200,
        durationMs: 0,
        userId: user.id,
        ip: req.ip ?? null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        details: { username: normalizedUsername, role: user.role },
      });
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
    const userId = getSessionUserId(req.session.userId);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      pushAuditLog({
        event: "logout",
        method: "POST",
        path: api.auth.logout.path,
        statusCode: 200,
        durationMs: 0,
        userId,
        ip: req.ip ?? null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
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
      console.log("[appointments.create] request received");
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
        paymentMethod: (input.paymentMethod as string | undefined) ?? "cash_on_arrival",
        paymentStatus: (input.paymentStatus as string | undefined) ?? "unpaid",
        prepaidAmount: Math.max(0, Math.floor(Number(input.prepaidAmount ?? 0))),
        paymentReference: (input.paymentReference as string | undefined) ?? null,
        isDeleted: false,
      });

      await storage.createNotification({
        userId: input.barberId,
        message: `New appointment requested by ${input.guestFirstName || clientUser?.firstName || "a client"} for ${new Date(input.appointmentDate).toLocaleString()}`,
        isRead: false,
      });

      const bookedBranch = (await storage.getBranches()).find((b) => Number(b.id) === Number(input.branchId));
      const clientName = `${input.guestFirstName ?? clientUser?.firstName ?? ""} ${input.guestLastName ?? clientUser?.lastName ?? ""}`.trim() || "Client";
      const toEmailRaw = input.guestEmail ?? clientUser?.email ?? null;
      const toEmail = typeof toEmailRaw === "string" ? toEmailRaw.trim() : null;
      const appointmentDate = new Date(input.appointmentDate);
      if (toEmail) {
        const appointmentDateText = appointmentDate.toLocaleDateString();
        const appointmentTimeText = appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const barberName = `${barber.firstName} ${barber.lastName}`.trim();
        const subject = "Istanbul Salon - Appointment Request Received";
        const fallbackText = [
          "Istanbul Salon",
          `Hello ${clientName},`,
          "",
          "Thank you for choosing Istanbul Salon. We have successfully received your appointment request.",
          "Our team is currently reviewing your booking and will confirm it shortly.",
          "",
          `Service: ${selectedService.name}`,
          `Preferred Barber: ${barberName}`,
          `Branch: ${bookedBranch?.name ?? input.branchId}`,
          `Date: ${appointmentDateText}`,
          `Time: ${appointmentTimeText}`,
          "",
          "Once the barber confirms availability, you will receive another email with the final confirmation.",
          "",
          "Best regards,",
          "Istanbul Salon Team",
          `Phone: ${salonPhone}`,
          `Address: ${salonAddress}`,
        ].join("\n");

        const emailResult = await sendEmail(toEmail, subject, fallbackText, {
          email: toEmail,
          client_email: toEmail,
          client_name: clientName,
          service_name: selectedService.name,
          barber_name: barberName,
          branch_name: bookedBranch?.name ?? String(input.branchId),
          appointment_date: appointmentDateText,
          appointment_time: appointmentTimeText,
          salon_phone: salonPhone,
          salon_address: salonAddress,
        });
        if (!emailResult.sent) {
          console.warn("[appointments.create] reservation email failed", {
            toEmail,
            provider: emailResult.provider,
            error: emailResult.error,
          });
        } else {
          console.log("[appointments.create] reservation email sent", {
            toEmail,
            provider: emailResult.provider,
          });
        }
      } else {
        console.warn("[appointments.create] no recipient email on reservation");
      }

      res.status(201).json(appointment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.payments.payseraCreateSession.path, async (req, res) => {
    try {
      const { appointmentId, amount } = api.payments.payseraCreateSession.input.parse(req.body);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });

      const reference = appointment.paymentReference || makePaymentReference(appointment.id);
      await storage.updateAppointment(appointment.id, {
        paymentMethod: "paysera_test",
        paymentStatus: "pending",
        prepaidAmount: Math.max(0, Math.floor(amount)),
        paymentReference: reference,
      });

      const checkoutUrl = `${payseraTestBaseUrl}?reference=${encodeURIComponent(reference)}&amount=${encodeURIComponent(String(Math.max(0, Math.floor(amount))))}&appointmentId=${appointment.id}`;
      return res.json({ ok: true, checkoutUrl, reference, mode: "test" as const });
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.payments.payseraConfirm.path, async (req, res) => {
    try {
      const { appointmentId, reference } = api.payments.payseraConfirm.input.parse(req.body);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ message: "Appointment not found" });

      if (appointment.paymentReference && appointment.paymentReference !== reference) {
        return res.status(409).json({ message: "Payment reference mismatch" });
      }

      const updated = await storage.updateAppointment(appointment.id, {
        paymentMethod: "paysera_test",
        paymentStatus: "paid",
        paymentReference: reference,
      });

      if (updated.clientId) {
        await storage.createNotification({
          userId: updated.clientId,
          message: `Payment received in test mode for appointment #${updated.id}.`,
          isRead: false,
        });
      }

      return res.json({ ok: true, paymentStatus: updated.paymentStatus, appointmentId: updated.id });
    } catch {
      return res.status(400).json({ message: "Bad Request" });
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
        const notifyResult = await sendAppointmentUpdateNotification({
          email: notifyEmail,
          phone: notifyPhone,
          subject: "Appointment status update",
          message: statusMessage,
        });
        if (!notifyResult.email.sent && notifyEmail) {
          console.warn("[appointments.updateStatus] email notification failed", {
            email: notifyEmail,
            provider: notifyResult.email.provider,
            error: notifyResult.email.error,
          });
        }
        if (!notifyResult.sms.sent && notifyPhone) {
          console.warn("[appointments.updateStatus] sms notification failed", {
            phone: notifyPhone,
            provider: notifyResult.sms.provider,
            error: notifyResult.sms.error,
          });
        }
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

  app.get(api.admin.usersList.path, async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      const requestedType = String(req.query.type ?? "all").toLowerCase();
      const allUsers = await storage.getUsers();
      const allAppointments = await storage.getAppointments();

      const appointmentCountByClientId = new Map<number, number>();
      for (const appointment of allAppointments) {
        if (!appointment.clientId) continue;
        appointmentCountByClientId.set(
          appointment.clientId,
          (appointmentCountByClientId.get(appointment.clientId) ?? 0) + 1,
        );
      }

      const filtered = allUsers.filter((u) => {
        if (requestedType === "all") return true;
        if (requestedType === "barber") return u.role === "barber";
        if (requestedType === "client") return u.role === "client";
        return true;
      });

      const users = filtered.map((u) => ({
        id: u.id,
        role: u.role,
        username: u.username,
        passwordHash: u.password,
        authProvider: u.authProvider,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        email: u.email,
        emailVerified: u.emailVerified,
        loyaltyPoints: u.loyaltyPoints,
        branchId: u.branchId,
        yearsOfExperience: u.yearsOfExperience,
        bio: u.bio,
        photoUrl: u.photoUrl,
        isAvailable: u.isAvailable,
        unavailableHours: u.unavailableHours,
        reservationCount: appointmentCountByClientId.get(u.id) ?? 0,
      }));

      return res.json({
        ok: true,
        users,
        note: "Stored passwords are hashed and cannot be reversed to plain text for existing users.",
      });
    } catch (error: any) {
      console.error("[admin.usersList] failed", error);
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.admin.developerSnapshot.path, async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;

      let dbStatus: "up" | "down" = "up";
      let dbLatencyMs = 0;
      const dbStartedAt = Date.now();
      try {
        await pool.query("select 1 as ok");
        dbLatencyMs = Date.now() - dbStartedAt;
      } catch {
        dbStatus = "down";
        dbLatencyMs = Date.now() - dbStartedAt;
      }

      const users = await storage.getUsers();
      const barbers = users.filter((u) => u.role === "barber").length;
      const clients = users.filter((u) => u.role === "client").length;
      const admins = users.filter((u) => u.role === "admin").length;
      const appointmentItems = await storage.getAppointments();

      const statusCounts = appointmentItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {});
      const paymentCounts = appointmentItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.paymentStatus] = (acc[item.paymentStatus] ?? 0) + 1;
        return acc;
      }, {});

      const routeTable = extractRoutes(api);
      const uniqueRoutes = Array.from(new Map(routeTable.map((r) => [`${r.method} ${r.path}`, r])).values());

      const recentApiCalls = auditLogs
        .filter((l) => l.event === "api_call")
        .slice(-250)
        .reverse();
      const loginHistory = auditLogs
        .filter((l) => l.event === "login_success" || l.event === "login_failed" || l.event === "logout")
        .slice(-250)
        .reverse();
      const recentReservations = appointmentItems
        .slice()
        .sort((a, b) => new Date(b.createdAt ?? b.appointmentDate).getTime() - new Date(a.createdAt ?? a.appointmentDate).getTime())
        .slice(0, 200)
        .map((a) => ({
          id: a.id,
          createdAt: a.createdAt,
          appointmentDate: a.appointmentDate,
          status: a.status,
          paymentMethod: a.paymentMethod,
          paymentStatus: a.paymentStatus,
          prepaidAmount: a.prepaidAmount,
          paymentReference: a.paymentReference,
          guestFirstName: a.guestFirstName,
          guestLastName: a.guestLastName,
          guestPhone: a.guestPhone,
          guestEmail: a.guestEmail,
          clientId: a.clientId,
          barberId: a.barberId,
          serviceId: a.serviceId,
          branchId: a.branchId,
        }));

      const vulnerabilities: string[] = [];
      if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change-this-session-secret") {
        vulnerabilities.push("SESSION_SECRET is default or missing.");
      }
      if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY && !process.env.EMAILJS_SERVICE_ID && !process.env.VITE_EMAILJS_SERVICE_ID) {
        vulnerabilities.push("No transactional email provider key configured.");
      }
      if (dbStatus === "down") {
        vulnerabilities.push("Database health check failed.");
      }

      const securityChecks = [
        process.env.NODE_ENV === "production",
        Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-this-session-secret"),
        dbStatus === "up",
        Boolean(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID),
      ];
      const securityScore = Math.round((securityChecks.filter(Boolean).length / securityChecks.length) * 100);

      const snapshot = {
        generatedAt: new Date().toISOString(),
        generatedBy: { id: admin.id, username: admin.username, role: admin.role },
        app: {
          environment: process.env.NODE_ENV ?? "development",
          uptimeSeconds: Math.floor(process.uptime()),
          host: process.env.HOST ?? "0.0.0.0",
          port: Number(process.env.PORT ?? 5000),
          appBaseUrl: process.env.APP_BASE_URL ?? null,
          trustProxy: true,
        },
        network: {
          status: dbStatus === "up" ? "online" : "degraded",
          domain: (() => {
            try {
              if (!process.env.APP_BASE_URL) return null;
              return new URL(process.env.APP_BASE_URL).hostname;
            } catch {
              return null;
            }
          })(),
          dbStatus,
          dbLatencyMs,
        },
        authAndSecurity: {
          mode: "session_cookie",
          jwtEnabled: false,
          firewall: "application-level checks only",
          sessionSecretConfigured: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-this-session-secret"),
          securityScore,
          vulnerabilities,
        },
        counts: {
          users: users.length,
          admins,
          barbers,
          clients,
          appointments: appointmentItems.length,
          statusCounts,
          paymentCounts,
          routes: uniqueRoutes.length,
        },
        routes: uniqueRoutes,
        recentApiCalls,
        loginHistory,
        recentReservations,
      };

      return res.json({ ok: true, snapshot });
    } catch (error: any) {
      console.error("[admin.developerSnapshot] failed", error);
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.admin.developerExport.path, async (req, res) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      let dbStatus: "up" | "down" = "up";
      let dbLatencyMs = 0;
      const dbStartedAt = Date.now();
      try {
        await pool.query("select 1 as ok");
        dbLatencyMs = Date.now() - dbStartedAt;
      } catch {
        dbStatus = "down";
        dbLatencyMs = Date.now() - dbStartedAt;
      }

      const users = await storage.getUsers();
      const appointmentItems = await storage.getAppointments();
      const routeTable = extractRoutes(api);
      const uniqueRoutes = Array.from(new Map(routeTable.map((r) => [`${r.method} ${r.path}`, r])).values());
      const vulnerabilities: string[] = [];
      if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change-this-session-secret") vulnerabilities.push("SESSION_SECRET is default or missing.");
      if (dbStatus === "down") vulnerabilities.push("Database health check failed.");
      const securityChecks = [
        process.env.NODE_ENV === "production",
        Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-this-session-secret"),
        dbStatus === "up",
      ];
      const securityScore = Math.round((securityChecks.filter(Boolean).length / securityChecks.length) * 100);

      const payload = {
        ok: true,
        snapshot: {
          generatedAt: new Date().toISOString(),
          generatedBy: { id: admin.id, username: admin.username, role: admin.role },
          network: { dbStatus, dbLatencyMs, host: process.env.HOST ?? "0.0.0.0", appBaseUrl: process.env.APP_BASE_URL ?? null },
          authAndSecurity: { mode: "session_cookie", jwtEnabled: false, securityScore, vulnerabilities },
          counts: { users: users.length, appointments: appointmentItems.length, routes: uniqueRoutes.length },
          routes: uniqueRoutes,
          recentApiCalls: auditLogs.slice(-1000),
          recentReservations: appointmentItems.slice(-1000),
        },
      };

      const fileName = `developer-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (error: any) {
      console.error("[admin.developerExport] failed", error);
      return res.status(400).json({ message: "Bad Request" });
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

