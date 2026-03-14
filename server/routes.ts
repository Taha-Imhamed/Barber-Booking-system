import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import crypto from "crypto";
import os from "os";
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
  const configuredAppBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || "";
  const configuredApiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "") || "";
  const defaultGoogleClientId = "519299194836-q7bvbn0jlonm6u47crap9lfhcg6835m0.apps.googleusercontent.com";

  function getRequestOrigin(req?: Express.Request) {
    const forwardedProtoHeader = req?.headers["x-forwarded-proto"];
    const forwardedHostHeader = req?.headers["x-forwarded-host"];
    const forwardedProto = Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : String(forwardedProtoHeader ?? "").split(",")[0];
    const forwardedHost = Array.isArray(forwardedHostHeader) ? forwardedHostHeader[0] : String(forwardedHostHeader ?? "").split(",")[0];
    const protocol = forwardedProto || req?.protocol || "https";
    const host = forwardedHost || req?.get("host") || process.env.VERCEL_URL || "";
    if (host) return `${protocol}://${host.replace(/\/$/, "")}`;
    return "http://localhost:5000";
  }

  function getPublicAppBaseUrl(req?: Express.Request) {
    return getRequestOrigin(req) || configuredAppBaseUrl || "http://localhost:5000";
  }

  function getPublicApiBaseUrl(req?: Express.Request) {
    return configuredApiBaseUrl || getRequestOrigin(req) || configuredAppBaseUrl || "http://localhost:5000";
  }

  function getGoogleRedirectUri(req?: Express.Request) {
    return process.env.GOOGLE_REDIRECT_URI || `${getPublicApiBaseUrl(req)}${api.auth.googleCallback.path}`;
  }

  function getGoogleClientId() {
    return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || defaultGoogleClientId;
  }

  function getGoogleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
  }

  async function createAndSendVerificationEmail(req: Express.Request, userId: number, email: string, firstName: string) {
    const token = crypto.randomBytes(32).toString("hex");
    await storage.createEmailVerificationToken({
      userId,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    const verifyUrl = `${getPublicAppBaseUrl(req)}/auth?verifyToken=${token}`;
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

  async function persistAudit(userId: number | null, action: string, metadata?: Record<string, unknown>) {
    await pool.query(
      "insert into audit_logs (user_id, action, metadata) values ($1, $2, $3)",
      [userId, action, metadata ? JSON.stringify(metadata) : null],
    );
  }

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

  const ADMIN_PERMISSIONS = [
    "appointments",
    "barbers",
    "services",
    "reports",
    "timetable",
    "finance",
    "chat",
    "wallDisplay",
    "gallery",
    "users",
    "growth",
    "developer",
    "manage_admins",
  ] as const;

  function getAdminPermissions(user: any): string[] {
    try {
      const parsed = JSON.parse(user?.adminPermissions ?? "[]");
      return Array.isArray(parsed) ? parsed.map((p) => String(p)) : [];
    } catch {
      return [];
    }
  }

  function hasAdminPermission(user: any, permission: string): boolean {
    if (!user || user.role !== "admin") return false;
    const perms = getAdminPermissions(user);
    // Empty permissions means full-access main admin.
    if (perms.length === 0) return true;
    return perms.includes(permission);
  }

  async function requireAdminPermission(req: any, res: any, permission: string) {
    const admin = await requireAdmin(req, res);
    if (!admin) return null;
    if (!hasAdminPermission(admin, permission)) {
      res.status(403).json({ message: "No access to this section." });
      return null;
    }
    return admin;
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
        instagramUrl: null,
        isAvailable: true,
        unavailableHours: "[]",
        adminPermissions: "[]",
      });
    }

    const serviceItems = await storage.getServices();
    if (serviceItems.length === 0) {
      await storage.createService({ name: "Haircut", price: 20, durationMinutes: 30 });
      await storage.createService({ name: "Beard Trim", price: 15, durationMinutes: 20 });
      await storage.createService({ name: "Full Package (Hair + Beard)", price: 30, durationMinutes: 50 });
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
      const normalizedUsername = username.trim().toLowerCase();
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
      const normalizedUsername = input.username?.trim().toLowerCase() ?? null;
      const hashedPassword = input.password ? await hash(input.password, 10) : null;
      const user = await storage.createUser({
        username: normalizedUsername,
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
        instagramUrl: input.instagramUrl ?? null,
        isAvailable: true,
        unavailableHours: "[]",
        adminPermissions: "[]",
      });
      if (user.email && !user.emailVerified) {
        await createAndSendVerificationEmail(req, user.id, user.email, user.firstName);
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

    const redirectUri = getGoogleRedirectUri(_req);
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
          redirect_uri: getGoogleRedirectUri(req),
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
          instagramUrl: null,
          isAvailable: true,
          unavailableHours: "[]",
          adminPermissions: "[]",
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
      res.redirect(`${getPublicAppBaseUrl(req)}/?auth=google_success`);
    } catch {
      res.status(400).json({ message: "Google sign-in failed." });
    }
  });

  app.get(api.auth.facebook.path, async (_req, res) => {
    return res.redirect("/auth?provider=facebook_not_configured");
  });

  app.get(api.auth.apple.path, async (_req, res) => {
    return res.redirect("/auth?provider=apple_not_configured");
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
      await createAndSendVerificationEmail(req, user.id, user.email, user.firstName);
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
    const admin = await requireAdminPermission(req, res, "barbers");
    if (!admin) return;
    try {
      const input = api.branches.create.input.parse(req.body);
      const branch = await storage.createBranch(input);
      res.status(201).json(branch);
    } catch (error: any) {
      const message =
        process.env.NODE_ENV === "development"
          ? error?.message || "Bad Request"
          : "Bad Request";
      res.status(400).json({ message });
    }
  });

  app.delete(api.branches.delete.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "barbers");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteBranch(id);
      if (!ok) {
        return res.status(400).json({ message: "Cannot delete the last branch. Create another branch first." });
      }
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Cannot delete branch right now. Please try again." });
    }
  });

  app.get(api.services.list.path, async (_req, res) => {
    const serviceItems = await storage.getServices();
    res.set("Cache-Control", "no-store");
    res.json(serviceItems);
  });

  app.post(api.services.create.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "services");
    if (!admin) return;
    try {
      const input = api.services.create.input.parse(req.body);
      const service = await storage.createService(input);
      res.status(201).json(service);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.services.update.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "services");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const input = api.services.update.input.parse(req.body);
      const service = await storage.updateService(id, input);
      res.json(service);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.services.delete.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "services");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const ok = await storage.deleteService(id);
      if (!ok) {
        return res.status(400).json({ message: "Cannot delete the last service. Create another service first." });
      }
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Cannot delete service right now." });
    }
  });

  app.get(api.barbers.list.path, async (_req, res) => {
    const barbers = await storage.getBarbers();
    res.json(barbers);
  });

  app.post(api.barbers.create.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "barbers");
    if (!admin) return;
    try {
      const input = api.barbers.create.input.parse(req.body);
      const normalizedUsername = input.username?.trim().toLowerCase() ?? null;
      if (!normalizedUsername) {
        return res.status(400).json({ message: "Username is required." });
      }
      const existing = await storage.getUserByUsername(normalizedUsername);
      if (existing) {
        return res.status(400).json({ message: "Username already exists." });
      }
      const hashedPassword = input.password ? await hash(input.password, 10) : null;
      if (!hashedPassword) {
        return res.status(400).json({ message: "Password is required." });
      }
      const nullIfEmpty = (value?: string | null) => {
        if (typeof value !== "string") return value ?? null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };
      const barber = await storage.createUser({
        username: normalizedUsername,
        googleId: nullIfEmpty(input.googleId),
        password: hashedPassword,
        authProvider: "local",
        role: "barber",
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: nullIfEmpty(input.phone),
        email: nullIfEmpty(input.email),
        emailVerified: true,
        loyaltyPoints: input.loyaltyPoints ?? 0,
        branchId: input.branchId ?? null,
        yearsOfExperience: input.yearsOfExperience ?? null,
        bio: nullIfEmpty(input.bio),
        photoUrl: nullIfEmpty(input.photoUrl),
        instagramUrl: nullIfEmpty(input.instagramUrl),
        isAvailable: true,
        unavailableHours: "[]",
        adminPermissions: "[]",
      });
      res.status(201).json(barber);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("[barbers.create] failed", {
        message: err?.message,
        code: err?.code,
        constraint: err?.constraint,
        bodyKeys: Object.keys(req.body ?? {}),
      });
      if (process.env.NODE_ENV === "development") {
        return res.status(400).json({
          message: err?.message || "Bad Request",
          code: err?.code,
          constraint: err?.constraint,
        });
      }
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.barbers.update.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const sessionUserId = getSessionUserId(req.session.userId);
      if (!sessionUserId) return res.status(401).json({ message: "Not logged in" });
      const actor = await storage.getUser(sessionUserId);
      if (!actor) return res.status(401).json({ message: "Not logged in" });
      const input = api.barbers.update.input.parse(req.body);
      const isAdmin = actor.role === "admin" && hasAdminPermission(actor, "barbers");
      const isSelfBarber = actor.role === "barber" && Number(actor.id) === Number(id);

      if (!isAdmin && !isSelfBarber) {
        return res.status(403).json({ message: "Forbidden" });
      }

      let nextInput = { ...input } as any;
      if (isSelfBarber) {
        const allowed = new Set(["photoUrl", "isAvailable", "unavailableHours", "instagramUrl", "password"]);
        nextInput = Object.fromEntries(Object.entries(nextInput).filter(([key]) => allowed.has(key)));
        if (typeof nextInput.password === "string" && nextInput.password.trim().length > 0) {
          nextInput.password = await hash(nextInput.password.trim(), 10);
        } else {
          delete nextInput.password;
        }
      } else {
        if (typeof nextInput.password === "string" && nextInput.password.trim().length > 0) {
          nextInput.password = await hash(nextInput.password.trim(), 10);
        } else {
          delete nextInput.password;
        }
      }
      if (Object.keys(nextInput).length === 0) {
        return res.status(400).json({ message: "No valid fields to update." });
      }
      const barber = await storage.updateUser(id, nextInput);
      res.json(barber);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.barbers.delete.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "barbers");
    if (!admin) return;
    try {
      const adminId = req.session.userId;
      if (!adminId) return res.status(401).json({ message: "Not logged in" });
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const id = Number.parseInt(req.params.id, 10);
      const barber = await storage.getUser(id);
      if (!barber || barber.role !== "barber") return res.status(404).json({ message: "Barber not found" });
      const barberAppointments = await storage.getAppointmentsByBarber(id);
      const activeCount = barberAppointments.filter((a) => ["pending", "accepted", "postponed"].includes(String(a.status))).length;
      if (activeCount > 0) {
        return res.status(400).json({
          message: `Cannot delete barber while ${activeCount} active request(s) exist. Complete/cancel those appointments first.`,
        });
      }
      const ok = await storage.deleteBarber(id);
      res.json({ ok });
    } catch {
      res.status(400).json({ message: "Cannot delete barber right now. Please try again." });
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
      const requestedServiceIds = Array.isArray(req.body.serviceIds)
        ? req.body.serviceIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isFinite(v))
        : [Number(input.serviceId)];
      const selectedServices = requestedServiceIds
        .map((id: number) => serviceById.get(id))
        .filter(Boolean) as (typeof allServices)[number][];
      if (selectedServices.length === 0) {
        return res.status(400).json({ message: "Invalid service." });
      }
      const selectedService = selectedServices[0];
      const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
      const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price ?? 0), 0);

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
      const requestedLockMinutes = Math.max(totalDuration || selectedService.durationMinutes, minimumBarberLockMinutes);
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
      if (clientUser?.isFlaggedNoShow) {
        return res.status(403).json({ message: "Booking restricted. Please contact support due to repeated no-shows." });
      }
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
        totalDurationMinutes: totalDuration,
        totalPrice,
        isDeleted: false,
        cancelledAt: null,
        noShowMarkedAt: null,
      });

      for (const service of selectedServices) {
        await pool.query(
          "insert into appointment_services (appointment_id, service_id, duration_minutes, price) values ($1, $2, $3, $4)",
          [appointment.id, service.id, service.durationMinutes, service.price],
        );
      }

      await storage.createNotification({
        userId: input.barberId,
        message: `New appointment requested by ${input.guestFirstName || clientUser?.firstName || "a client"} for ${new Date(input.appointmentDate).toLocaleString()}`,
        isRead: false,
      });

      const bookedBranch = (await storage.getBranches()).find((b) => Number(b.id) === Number(input.branchId));
      const clientName = `${input.guestFirstName ?? clientUser?.firstName ?? ""} ${input.guestLastName ?? clientUser?.lastName ?? ""}`.trim() || "Client";
      const toEmailRaw = input.guestEmail ?? clientUser?.email ?? null;
      const toEmail = typeof toEmailRaw === "string" ? toEmailRaw.trim() : null;
      const toPhoneRaw = input.guestPhone ?? clientUser?.phone ?? null;
      const toPhone = typeof toPhoneRaw === "string" ? normalizePhone(toPhoneRaw) : null;
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
          event_type: "reservation_requested",
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

      if (toPhone) {
        const appointmentDateText = appointmentDate.toLocaleDateString();
        const appointmentTimeText = appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const smsMessage = `Istanbul Salon: Hi ${clientName}, your reservation request was received for ${appointmentDateText} ${appointmentTimeText}. We will confirm shortly.`;
        const smsResult = await sendSms(toPhone, smsMessage);
        if (!smsResult.sent) {
          console.warn("[appointments.create] reservation sms failed", {
            toPhone,
            provider: smsResult.provider,
            error: smsResult.error,
          });
        } else {
          console.log("[appointments.create] reservation sms sent", {
            toPhone,
            provider: smsResult.provider,
          });
        }
      } else {
        console.warn("[appointments.create] no recipient phone on reservation");
      }

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
      if (status === "cancelled") {
        const freeCancelHoursSetting = await storage.getAppSetting("cancellation_free_hours");
        const lateFeeSetting = await storage.getAppSetting("cancellation_late_fee");
        const freeCancelHours = Number.parseInt(freeCancelHoursSetting ?? "3", 10);
        const lateFee = Number.parseInt(lateFeeSetting ?? "10", 10);
        const hoursToAppointment = (new Date(appointmentBeforeUpdate.appointmentDate).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursToAppointment < freeCancelHours) {
          return res.status(400).json({
            message: `Late cancellation fee applies: Lek ${lateFee}. Free cancellation is allowed up to ${freeCancelHours} hours.`,
          });
        }
      }
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
          cancelledAt: status === "cancelled" ? new Date() : appointmentBeforeUpdate.cancelledAt,
          noShowMarkedAt: status === "no_show" ? new Date() : appointmentBeforeUpdate.noShowMarkedAt,
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

      if (status === "no_show" && appointment.clientId) {
        const client = await storage.getUser(appointment.clientId);
        if (client) {
          const nextCount = (client.noShowCount ?? 0) + 1;
          await storage.updateUser(client.id, {
            noShowCount: nextCount,
            isFlaggedNoShow: nextCount >= 3,
          });
          if (nextCount >= 3) {
            const users = await storage.getUsers();
            const admins = users.filter((u) => u.role === "admin");
            for (const admin of admins) {
              await storage.createNotification({
                userId: admin.id,
                message: `Client ${client.firstName} ${client.lastName} reached ${nextCount} no-shows and is now flagged.`,
                isRead: false,
              });
            }
          }
        }
      }

      if (["cancelled", "rejected"].includes(status)) {
        const waitlistRows = await pool.query(
          "select * from waitlist where service_id = $1 and date = $2 and status = 'waiting' order by created_at asc",
          [appointment.serviceId, appointment.appointmentDate],
        );
        for (const row of waitlistRows.rows) {
          await pool.query("update waitlist set status = 'notified' where id = $1", [row.id]);
          await storage.createNotification({
            userId: row.client_id,
            message: "A slot opened up for your waitlist request. Confirm quickly to claim it.",
            isRead: false,
          });
        }
      }

      await persistAudit(actor?.id ?? null, "appointment_status_changed", {
        appointmentId: appointment.id,
        from: appointmentBeforeUpdate.status,
        to: status,
      });

      const appointmentClient = appointment.clientId ? await storage.getUser(appointment.clientId) : undefined;
      const notifyEmail = appointment.guestEmail ?? appointmentBeforeUpdate?.guestEmail ?? appointmentClient?.email ?? null;
      const notifyPhone = appointment.guestPhone ?? appointmentBeforeUpdate?.guestPhone ?? appointmentClient?.phone ?? null;

      if (notifyPhone || notifyEmail) {
        if (status === "accepted" && notifyEmail) {
          const branch = (await storage.getBranches()).find((b) => Number(b.id) === Number(appointment.branchId));
          const service = (await storage.getServices()).find((s) => Number(s.id) === Number(appointment.serviceId));
          const serviceRows = await pool.query(
            `
            select s.name, aps.price, aps.duration_minutes
            from appointment_services aps
            join services s on s.id = aps.service_id
            where aps.appointment_id = $1
            order by aps.id asc
            `,
            [appointment.id],
          );
          const normalizedServiceRows = (serviceRows.rows ?? []).map((row: any) => ({
            name: String(row?.name ?? "").trim(),
            price: Number(row?.price ?? 0),
            durationMinutes: Number(row?.duration_minutes ?? 0),
          }));
          const fallbackServiceName = service?.name ?? String(appointment.serviceId);
          const servicesSummary =
            normalizedServiceRows.length > 0
              ? normalizedServiceRows.map((r) => `${r.name} (Lek ${r.price}, ${r.durationMinutes}m)`).join(", ")
              : fallbackServiceName;
          const computedTotalPrice =
            appointment.totalPrice != null
              ? Number(appointment.totalPrice)
              : normalizedServiceRows.length > 0
                ? normalizedServiceRows.reduce((sum, r) => sum + r.price, 0)
                : Number(service?.price ?? 0);
          const computedTotalDuration =
            appointment.totalDurationMinutes != null
              ? Number(appointment.totalDurationMinutes)
              : normalizedServiceRows.length > 0
                ? normalizedServiceRows.reduce((sum, r) => sum + r.durationMinutes, 0)
                : Number(service?.durationMinutes ?? 0);
          const barberUser = await storage.getUser(appointment.barberId);
          const clientName =
            `${appointment.guestFirstName ?? appointmentClient?.firstName ?? ""} ${appointment.guestLastName ?? appointmentClient?.lastName ?? ""}`.trim() ||
            "Client";
          const barberName = `${barberUser?.firstName ?? ""} ${barberUser?.lastName ?? ""}`.trim() || "Your barber";
          const dateText = new Date(appointment.appointmentDate).toLocaleDateString();
          const timeText = new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const subject = "Istanbul Salon - Reservation Confirmed";
          const message = [
            `Hello ${clientName},`,
            "",
            "Great news. Your reservation has been confirmed.",
            "",
            `Services: ${servicesSummary}`,
            `Barber: ${barberName}`,
            `Branch: ${branch?.name ?? appointment.branchId}`,
            `Date: ${dateText}`,
            `Time: ${timeText}`,
            `Total Duration: ${computedTotalDuration} min`,
            `Total Price: Lek ${computedTotalPrice}`,
            "",
            "We look forward to seeing you.",
            "",
            "Istanbul Salon Team",
          ].join("\n");
          const emailResult = await sendEmail(notifyEmail, subject, message, {
            event_type: "reservation_confirmed",
            client_email: notifyEmail,
            client_name: clientName,
            service_name: fallbackServiceName,
            services_summary: servicesSummary,
            barber_name: barberName,
            branch_name: branch?.name ?? String(appointment.branchId),
            appointment_date: dateText,
            appointment_time: timeText,
            total_duration: computedTotalDuration,
            total_price: computedTotalPrice,
            salon_phone: salonPhone,
            salon_address: salonAddress,
          });
          if (!emailResult.sent) {
            console.warn("[appointments.updateStatus] accepted email notification failed", {
              email: notifyEmail,
              provider: emailResult.provider,
              error: emailResult.error,
            });
          }
          if (notifyPhone) {
            const smsResult = await sendSms(notifyPhone, statusMessage);
            if (!smsResult.sent) {
              console.warn("[appointments.updateStatus] sms notification failed", {
                phone: notifyPhone,
                provider: smsResult.provider,
                error: smsResult.error,
              });
            }
          }
        } else {
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
      const admin = await requireAdminPermission(req, res, "appointments");
      if (!admin) return;

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
      const admin = await requireAdminPermission(req, res, "appointments");
      if (!admin) return;
      const raw = req.body ?? {};
      const candidateIds =
        Array.isArray(raw.ids) ? raw.ids :
        Array.isArray((raw as any).appointmentIds) ? (raw as any).appointmentIds :
        (raw as any).id != null ? [(raw as any).id] :
        [];
      if (candidateIds.length === 0) {
        return res.status(400).json({ message: "Provide appointment ids to delete." });
      }
      const { ids } = api.admin.deleteAppointments.input.parse({ ids: candidateIds });
      const deleted = await storage.deleteAppointmentsByIds(ids);
      res.json({ ok: true, deleted });
    } catch (error: any) {
      console.error("[admin.deleteAppointments] failed", error);
      res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  app.post(api.admin.settings.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "wallDisplay");
      if (!admin) return;
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
      const admin = await requireAdminPermission(req, res, "users");
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
        instagramUrl: u.instagramUrl,
        isAvailable: u.isAvailable,
        unavailableHours: u.unavailableHours,
        adminPermissions: u.adminPermissions,
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

  app.delete(api.admin.deleteUser.path, async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (!hasAdminPermission(admin, "users") && !hasAdminPermission(admin, "manage_admins")) {
      res.status(403).json({ message: "No access to this section." });
      return;
    }
    try {
      const id = Number.parseInt(req.params.id, 10);
      const target = await storage.getUser(id);
      if (!target) return res.status(404).json({ message: "User not found." });
      if (id === admin.id) return res.status(400).json({ message: "You cannot delete your own account." });
      if (target.role === "barber") {
        return res.status(400).json({ message: "Delete barbers from the Barbers tab." });
      }
      if (target.role === "admin" && (target.username ?? "").toLowerCase() === "admin") {
        return res.status(400).json({ message: "Main admin cannot be deleted." });
      }
      const ok = await storage.deleteUser(id);
      return res.json({ ok });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  app.post(api.admin.createAdmin.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "manage_admins");
    if (!admin) return;
    try {
      const input = api.admin.createAdmin.input.parse(req.body);
      const normalizedUsername = input.username.trim().toLowerCase();
      const existing = await storage.getUserByUsername(normalizedUsername);
      if (existing) return res.status(400).json({ message: "Username already exists." });
      const hashedPassword = await hash(input.password.trim(), 10);
      const allowed = new Set<string>(ADMIN_PERMISSIONS);
      const permissions = (input.permissions ?? []).filter((p) => allowed.has(String(p)));
      const created = await storage.createUser({
        username: normalizedUsername,
        googleId: null,
        password: hashedPassword,
        authProvider: "local",
        role: "admin",
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        emailVerified: true,
        loyaltyPoints: 0,
        branchId: null,
        yearsOfExperience: null,
        bio: "Sub-admin account",
        photoUrl: null,
        instagramUrl: null,
        isAvailable: true,
        unavailableHours: "[]",
        adminPermissions: JSON.stringify(permissions),
      });
      await persistAudit(admin.id, "admin_created", { targetAdminId: created.id, permissionsCount: permissions.length });
      return res.status(201).json({ ok: true, user: created });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  app.get(api.admin.adminsList.path, async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (!hasAdminPermission(admin, "manage_admins") && !hasAdminPermission(admin, "developer")) {
      res.status(403).json({ message: "No access to this section." });
      return;
    }
    try {
      const users = await storage.getUsers();
      const admins = users
        .filter((u) => u.role === "admin")
        .map((u) => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          adminPermissions: u.adminPermissions,
          isMainAdmin: (u.username ?? "").toLowerCase() === "admin",
        }));
      return res.json({ ok: true, admins });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  app.patch(api.admin.updateAdminPermissions.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "manage_admins");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const target = await storage.getUser(id);
      if (!target || target.role !== "admin") return res.status(404).json({ message: "Admin not found." });
      if (id === admin.id) return res.status(400).json({ message: "Use another admin to edit your own permissions." });
      const { permissions } = api.admin.updateAdminPermissions.input.parse(req.body);
      const allowed = new Set<string>(ADMIN_PERMISSIONS);
      const nextPerms = permissions.filter((p) => allowed.has(String(p)));
      await storage.updateUser(id, { adminPermissions: JSON.stringify(nextPerms) });
      await persistAudit(admin.id, "admin_permissions_updated", { targetAdminId: id, permissionsCount: nextPerms.length });
      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  app.patch(api.admin.changeAdminPassword.path, async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (!hasAdminPermission(admin, "manage_admins") && !hasAdminPermission(admin, "developer")) {
      res.status(403).json({ message: "No access to this section." });
      return;
    }
    try {
      const id = Number.parseInt(req.params.id, 10);
      const target = await storage.getUser(id);
      if (!target || target.role !== "admin") return res.status(404).json({ message: "Admin not found." });
      const { password, username } = api.admin.changeAdminPassword.input.parse(req.body);
      if (!password && !username) return res.status(400).json({ message: "Provide username or password." });
      const nextData: Record<string, any> = {};
      if (password) nextData.password = await hash(password.trim(), 10);
      if (username) {
        const normalizedUsername = username.trim().toLowerCase();
        const existing = await storage.getUserByUsername(normalizedUsername);
        if (existing && existing.id !== id) return res.status(400).json({ message: "Username already exists." });
        nextData.username = normalizedUsername;
      }
      await storage.updateUser(id, nextData);
      await persistAudit(admin.id, "admin_credentials_changed", { targetAdminId: id, updatedUsername: Boolean(username), updatedPassword: Boolean(password) });
      return res.json({ ok: true });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Bad Request" });
    }
  });

  async function buildSchemaSnapshot() {
    const tablesRes = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name asc
    `);
    const columnsRes = await pool.query(`
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
      order by table_name asc, ordinal_position asc
    `);
    const constraintsRes = await pool.query(`
      select tc.table_name, tc.constraint_name, tc.constraint_type
      from information_schema.table_constraints tc
      where tc.table_schema = 'public'
      order by tc.table_name asc, tc.constraint_type asc
    `);
    const rowEstimatesRes = await pool.query(`
      select relname as table_name, n_live_tup::bigint as estimated_rows
      from pg_stat_user_tables
      order by relname asc
    `);

    const columnMap = new Map<string, any[]>();
    for (const c of columnsRes.rows) {
      const list = columnMap.get(c.table_name) ?? [];
      list.push({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === "YES",
      });
      columnMap.set(c.table_name, list);
    }

    const constraintMap = new Map<string, any[]>();
    for (const c of constraintsRes.rows) {
      const list = constraintMap.get(c.table_name) ?? [];
      list.push({
        name: c.constraint_name,
        type: c.constraint_type,
      });
      constraintMap.set(c.table_name, list);
    }

    const rowMap = new Map<string, number>();
    for (const r of rowEstimatesRes.rows) {
      rowMap.set(r.table_name, Number(r.estimated_rows ?? 0));
    }

    const tables = tablesRes.rows.map((t) => ({
      table: t.table_name,
      estimatedRows: rowMap.get(t.table_name) ?? 0,
      columns: columnMap.get(t.table_name) ?? [],
      constraints: constraintMap.get(t.table_name) ?? [],
    }));

    return {
      tablesCount: tables.length,
      tables,
    };
  }

  async function buildSqlMonitoringReport() {
    const pathCounts = new Map<string, number>();
    const statusCounts = new Map<number, number>();
    const durationBuckets = {
      fastLt100: 0,
      normal100To500: 0,
      slow500To1000: 0,
      criticalGt1000: 0,
    };
    const slowApiCalls = auditLogs
      .filter((a) => a.event === "api_call")
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 200);

    for (const log of auditLogs) {
      if (log.event !== "api_call") continue;
      const key = `${log.method} ${log.path}`;
      pathCounts.set(key, (pathCounts.get(key) ?? 0) + 1);
      statusCounts.set(log.statusCode, (statusCounts.get(log.statusCode) ?? 0) + 1);
      if (log.durationMs < 100) durationBuckets.fastLt100 += 1;
      else if (log.durationMs < 500) durationBuckets.normal100To500 += 1;
      else if (log.durationMs < 1000) durationBuckets.slow500To1000 += 1;
      else durationBuckets.criticalGt1000 += 1;
    }

    const topPaths = Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    const topStatuses = Array.from(statusCounts.entries())
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => b.count - a.count);

    const dbWaitRes = await pool.query(`
      select state, count(*)::int as count
      from pg_stat_activity
      group by state
      order by count desc
    `);

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        apiCallLogs: auditLogs.filter((a) => a.event === "api_call").length,
      },
      durationBuckets,
      topPaths,
      topStatuses,
      slowestApiCalls: slowApiCalls.slice(0, 50).map((a) => ({
        timestamp: a.timestamp,
        method: a.method,
        path: a.path,
        statusCode: a.statusCode,
        durationMs: a.durationMs,
        ip: a.ip,
      })),
      dbActivityStates: dbWaitRes.rows,
    };
  }

  function buildRuntimeNetworkConfig() {
    const appUrl = process.env.APP_BASE_URL ?? null;
    let domain: string | null = null;
    let protocol: string | null = null;
    let sslEnabled = false;
    try {
      if (appUrl) {
        const parsed = new URL(appUrl);
        domain = parsed.hostname;
        protocol = parsed.protocol.replace(":", "");
        sslEnabled = parsed.protocol === "https:";
      }
    } catch {
      domain = null;
      protocol = null;
      sslEnabled = false;
    }

    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const list of Object.values(interfaces)) {
      for (const i of list ?? []) {
        if (i.family === "IPv4" && !i.internal) ips.push(i.address);
      }
    }

    return {
      host: process.env.HOST ?? "0.0.0.0",
      port: Number(process.env.PORT ?? 5000),
      appBaseUrl: appUrl,
      domain,
      protocol,
      sslEnabled,
      trustProxy: true,
      bindIps: ips,
      sslCertConfigured: Boolean(process.env.SSL_CERT_PATH || process.env.TLS_CERT_PATH),
      sslKeyConfigured: Boolean(process.env.SSL_KEY_PATH || process.env.TLS_KEY_PATH),
    };
  }

  app.get(api.admin.developerSnapshot.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "developer");
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

      const runtimeNetwork = buildRuntimeNetworkConfig();
      const schemaSnapshot = await buildSchemaSnapshot();
      const sqlReport = await buildSqlMonitoringReport();

      const snapshot = {
        generatedAt: new Date().toISOString(),
        generatedBy: { id: admin.id, username: admin.username, role: admin.role },
        app: {
          environment: process.env.NODE_ENV ?? "development",
          uptimeSeconds: Math.floor(process.uptime()),
          host: runtimeNetwork.host,
          port: runtimeNetwork.port,
          appBaseUrl: runtimeNetwork.appBaseUrl,
          trustProxy: true,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memoryUsageMb: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          },
          cpuLoadAvg: os.loadavg(),
        },
        network: {
          status: dbStatus === "up" ? "online" : "degraded",
          domain: runtimeNetwork.domain,
          protocol: runtimeNetwork.protocol,
          sslEnabled: runtimeNetwork.sslEnabled,
          bindIps: runtimeNetwork.bindIps,
          sslCertConfigured: runtimeNetwork.sslCertConfigured,
          sslKeyConfigured: runtimeNetwork.sslKeyConfigured,
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
        dbSchema: schemaSnapshot,
        sqlMonitoring: sqlReport,
      };

      return res.json({ ok: true, snapshot });
    } catch (error: any) {
      console.error("[admin.developerSnapshot] failed", error);
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.admin.developerExport.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "developer");
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

      const runtimeNetwork = buildRuntimeNetworkConfig();
      const schemaSnapshot = await buildSchemaSnapshot();
      const sqlReport = await buildSqlMonitoringReport();
      const payload = {
        ok: true,
        snapshot: {
          generatedAt: new Date().toISOString(),
          generatedBy: { id: admin.id, username: admin.username, role: admin.role },
          network: {
            dbStatus,
            dbLatencyMs,
            host: runtimeNetwork.host,
            port: runtimeNetwork.port,
            appBaseUrl: runtimeNetwork.appBaseUrl,
            domain: runtimeNetwork.domain,
            protocol: runtimeNetwork.protocol,
            sslEnabled: runtimeNetwork.sslEnabled,
            bindIps: runtimeNetwork.bindIps,
          },
          authAndSecurity: { mode: "session_cookie", jwtEnabled: false, securityScore, vulnerabilities },
          counts: { users: users.length, appointments: appointmentItems.length, routes: uniqueRoutes.length },
          routes: uniqueRoutes,
          recentApiCalls: auditLogs.slice(-1000),
          recentReservations: appointmentItems.slice(-1000),
          dbSchema: schemaSnapshot,
          sqlMonitoring: sqlReport,
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

  app.get(api.admin.developerSchema.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "developer");
      if (!admin) return;
      const schema = await buildSchemaSnapshot();
      return res.json({ ok: true, schema });
    } catch (error: any) {
      console.error("[admin.developerSchema] failed", error);
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.admin.developerSqlReport.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "developer");
      if (!admin) return;
      const report = await buildSqlMonitoringReport();
      return res.json({ ok: true, report });
    } catch (error: any) {
      console.error("[admin.developerSqlReport] failed", error);
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.admin.developerSqlExport.path, async (req, res) => {
    try {
      const admin = await requireAdminPermission(req, res, "developer");
      if (!admin) return;
      const sqlTemplate = [
        "-- Developer SQL Monitoring Template",
        "-- Generated at: " + new Date().toISOString(),
        "",
        "-- 1) Active sessions by state",
        "select state, count(*)::int as count from pg_stat_activity group by state order by count desc;",
        "",
        "-- 2) Table row estimates",
        "select relname as table_name, n_live_tup::bigint as estimated_rows from pg_stat_user_tables order by relname asc;",
        "",
        "-- 3) Recently created appointments",
        "select id, appointment_date, status, payment_status, created_at from appointments order by created_at desc limit 200;",
        "",
        "-- 4) Reviews pending moderation",
        "select id, barber_id, client_id, rating, comment, created_at from reviews where is_approved = false order by created_at desc;",
        "",
        "-- 5) Inventory low stock (< 5)",
        "select id, product_name, stock_quantity, price from inventory where stock_quantity < 5 order by stock_quantity asc;",
        "",
        "-- 6) Flagged no-show clients",
        "select id, first_name, last_name, no_show_count, is_flagged_no_show from users where role='client' and is_flagged_no_show = true order by no_show_count desc;",
        "",
      ].join("\n");

      const fileName = `developer-sql-report-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
      res.setHeader("Content-Type", "application/sql; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.status(200).send(sqlTemplate);
    } catch (error: any) {
      console.error("[admin.developerSqlExport] failed", error);
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

  app.get(api.calendar.events.path, async (req, res) => {
    const barberIdRaw = String(req.query.barberId ?? "").trim();
    const appointments = barberIdRaw
      ? await storage.getAppointmentsByBarber(Number.parseInt(barberIdRaw, 10))
      : await storage.getAppointments();
    const events = appointments.map((a) => ({
      id: a.id,
      title: `Appointment #${a.id}`,
      start: a.appointmentDate,
      status: a.status,
      barberId: a.barberId,
      serviceId: a.serviceId,
      color:
        a.status === "accepted"
          ? "#15803d"
          : a.status === "rejected"
            ? "#b91c1c"
            : a.status === "completed"
              ? "#1d4ed8"
              : "#d97706",
    }));
    res.json(events);
  });

  app.patch(api.calendar.moveAppointment.path, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { appointmentDate } = api.calendar.moveAppointment.input.parse(req.body);
      const updated = await storage.updateAppointment(id, { appointmentDate: new Date(appointmentDate) });
      await persistAudit(getSessionUserId(req.session.userId), "calendar_drag_drop_move", { appointmentId: id, appointmentDate });
      return res.json(updated);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.clientHistory.profile.path, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    const client = await storage.getUser(userId);
    if (!client || client.role !== "client") return res.status(404).json({ message: "Client not found" });
    const allAppointments = await storage.getAppointments();
    const services = await storage.getServices();
    const barbers = await storage.getBarbers();
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const barberById = new Map(barbers.map((b) => [b.id, `${b.firstName} ${b.lastName}`.trim()]));
    const visits = allAppointments.filter((a) => a.clientId === userId && a.status === "completed");
    const serviceCount = new Map<number, number>();
    const barberCount = new Map<number, number>();
    for (const v of visits) {
      serviceCount.set(v.serviceId, (serviceCount.get(v.serviceId) ?? 0) + 1);
      barberCount.set(v.barberId, (barberCount.get(v.barberId) ?? 0) + 1);
    }
    const mostFrequentServiceId = Array.from(serviceCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoriteBarberId = Array.from(barberCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    return res.json({
      client: { id: client.id, firstName: client.firstName, lastName: client.lastName },
      visits: visits
        .sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
        .map((v) => ({
          id: v.id,
          date: v.appointmentDate,
          service: serviceById.get(v.serviceId)?.name ?? "Service",
          barber: barberById.get(v.barberId) ?? "Barber",
        })),
      favoriteBarber: favoriteBarberId ? barberById.get(favoriteBarberId) : null,
      mostFrequentService: mostFrequentServiceId ? serviceById.get(mostFrequentServiceId)?.name ?? null : null,
    });
  });

  app.get(api.reviews.list.path, async (_req, res) => {
    const rows = await pool.query("select * from reviews order by created_at desc");
    res.json(rows.rows);
  });

  app.post(api.reviews.create.path, async (req, res) => {
    try {
      const userId = getSessionUserId(req.session.userId);
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const { appointmentId, rating, comment } = api.reviews.create.input.parse(req.body);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.clientId !== userId || appointment.status !== "completed") {
        return res.status(400).json({ message: "Review is allowed only for your completed appointments." });
      }
      const row = await pool.query(
        "insert into reviews (barber_id, client_id, appointment_id, rating, comment, is_approved) values ($1, $2, $3, $4, $5, false) returning *",
        [appointment.barberId, userId, appointment.id, rating, comment ?? null],
      );
      await persistAudit(userId, "review_created", { appointmentId, rating });
      return res.status(201).json(row.rows[0]);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.reviews.moderate.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "reports");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { isApproved } = api.reviews.moderate.input.parse(req.body);
      const row = await pool.query("update reviews set is_approved = $1 where id = $2 returning *", [isApproved, id]);
      if (!row.rows[0]) return res.status(404).json({ message: "Review not found" });
      await persistAudit(admin.id, "review_moderated", { reviewId: id, isApproved });
      return res.json(row.rows[0]);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.reviews.average.path, async (req, res) => {
    const barberId = Number.parseInt(req.params.barberId, 10);
    const row = await pool.query(
      "select coalesce(avg(rating), 0) as avg, count(*)::int as count from reviews where barber_id = $1 and is_approved = true",
      [barberId],
    );
    res.json({ barberId, averageRating: Number(row.rows[0]?.avg ?? 0), count: Number(row.rows[0]?.count ?? 0) });
  });

  app.get(api.waitlist.list.path, async (_req, res) => {
    const rows = await pool.query("select * from waitlist order by created_at desc");
    res.json(rows.rows);
  });

  app.post(api.waitlist.join.path, async (req, res) => {
    try {
      const userId = getSessionUserId(req.session.userId);
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const { serviceId, date } = api.waitlist.join.input.parse(req.body);
      const row = await pool.query(
        "insert into waitlist (service_id, date, client_id, status) values ($1, $2, $3, 'waiting') returning *",
        [serviceId, new Date(date), userId],
      );
      return res.status(201).json(row.rows[0]);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.waitlist.claim.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const id = Number.parseInt(req.params.id, 10);
    const row = await pool.query("update waitlist set status = 'claimed' where id = $1 and client_id = $2 returning *", [id, userId]);
    if (!row.rows[0]) return res.status(404).json({ message: "Waitlist request not found" });
    res.json(row.rows[0]);
  });

  app.get(api.inventory.list.path, async (_req, res) => {
    const rows = await pool.query("select * from inventory order by id desc");
    res.json(rows.rows);
  });

  app.post(api.inventory.create.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    try {
      const { productName, stockQuantity, price } = api.inventory.create.input.parse(req.body);
      const row = await pool.query(
        "insert into inventory (product_name, stock_quantity, price) values ($1, $2, $3) returning *",
        [productName, stockQuantity, price],
      );
      await persistAudit(admin.id, "inventory_create", { productName, stockQuantity, price });
      return res.status(201).json(row.rows[0]);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.patch(api.inventory.update.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    try {
      const id = Number.parseInt(req.params.id, 10);
      const input = api.inventory.update.input.parse(req.body);
      const existing = await pool.query("select * from inventory where id = $1", [id]);
      if (!existing.rows[0]) return res.status(404).json({ message: "Not found" });
      const next = {
        productName: input.productName ?? existing.rows[0].product_name,
        stockQuantity: input.stockQuantity ?? existing.rows[0].stock_quantity,
        price: input.price ?? existing.rows[0].price,
      };
      const row = await pool.query(
        "update inventory set product_name = $1, stock_quantity = $2, price = $3, last_updated = now() where id = $4 returning *",
        [next.productName, next.stockQuantity, next.price, id],
      );
      await persistAudit(admin.id, "inventory_update", { inventoryId: id, ...next });
      return res.json(row.rows[0]);
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.delete(api.inventory.remove.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    const id = Number.parseInt(req.params.id, 10);
    const deleted = await pool.query("delete from inventory where id = $1 returning id", [id]);
    await persistAudit(admin.id, "inventory_delete", { inventoryId: id });
    res.json({ ok: (deleted.rowCount ?? 0) > 0 });
  });

  app.post(api.inventory.sale.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { quantity } = api.inventory.sale.input.parse(req.body);
      const row = await pool.query("select * from inventory where id = $1", [id]);
      if (!row.rows[0]) return res.status(404).json({ message: "Item not found" });
      if (row.rows[0].stock_quantity < quantity) return res.status(400).json({ message: "Insufficient stock" });
      const newStock = row.rows[0].stock_quantity - quantity;
      const totalAmount = row.rows[0].price * quantity;
      await pool.query("update inventory set stock_quantity = $1, last_updated = now() where id = $2", [newStock, id]);
      await pool.query(
        "insert into inventory_sales (inventory_id, quantity, total_amount, sold_by_user_id) values ($1, $2, $3, $4)",
        [id, quantity, totalAmount, userId],
      );
      res.json({ ok: true, newStock, totalAmount });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.analytics.dashboard.path, async (_req, res) => {
    const appointments = await storage.getAppointments();
    const services = await storage.getServices();
    const barbers = await storage.getBarbers();
    const earnings = await pool.query("select * from appointment_earnings");
    const bookingsPerDayMap = new Map<string, number>();
    const peakHoursMap = new Map<number, number>();
    const serviceCount = new Map<number, number>();
    const barberCount = new Map<number, number>();
    for (const a of appointments) {
      const d = new Date(a.appointmentDate);
      const key = d.toISOString().slice(0, 10);
      bookingsPerDayMap.set(key, (bookingsPerDayMap.get(key) ?? 0) + 1);
      peakHoursMap.set(d.getHours(), (peakHoursMap.get(d.getHours()) ?? 0) + 1);
      serviceCount.set(a.serviceId, (serviceCount.get(a.serviceId) ?? 0) + 1);
      barberCount.set(a.barberId, (barberCount.get(a.barberId) ?? 0) + 1);
    }
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = earnings.rows
      .filter((r) => String(r.earned_at ?? "").startsWith(monthKey))
      .reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);
    const mostPopularServiceId = Array.from(serviceCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const busiestBarberId = Array.from(barberCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const busiestHour = Array.from(peakHoursMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    res.json({
      bookingsPerDay: Array.from(bookingsPerDayMap.entries()).map(([date, count]) => ({ date, count })),
      mostPopularService: services.find((s) => s.id === mostPopularServiceId)?.name ?? null,
      busiestBarber:
        barbers.find((b) => b.id === busiestBarberId)
          ? `${barbers.find((b) => b.id === busiestBarberId)?.firstName} ${barbers.find((b) => b.id === busiestBarberId)?.lastName}`
          : null,
      peakHour: busiestHour,
      monthlyRevenue,
    });
  });

  app.post(api.aiAssistant.suggest.path, async (req, res) => {
    try {
      const { prompt } = api.aiAssistant.suggest.input.parse(req.body);
      const appointments = await storage.getAppointments();
      const hourCount = new Map<number, number>();
      for (const a of appointments) {
        const h = new Date(a.appointmentDate).getHours();
        hourCount.set(h, (hourCount.get(h) ?? 0) + 1);
      }
      const leastBusyHours = Array.from(hourCount.entries()).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([h]) => h);
      const mostBusyHours = Array.from(hourCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h);
      const lower = prompt.toLowerCase();
      if (lower.includes("best") || lower.includes("slot")) {
        return res.json({ answer: `Best times based on history: ${leastBusyHours.map((h) => `${h}:00`).join(", ")}.` });
      }
      if (lower.includes("busy")) {
        return res.json({ answer: `Predicted busy hours: ${mostBusyHours.map((h) => `${h}:00`).join(", ")}.` });
      }
      return res.json({ answer: "Try: 'Suggest best appointment slots today' or 'Predict busiest hours this weekend'." });
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.referrals.myCode.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    const existing = await pool.query("select * from referral_codes where user_id = $1 limit 1", [userId]);
    if (existing.rows[0]) return res.json(existing.rows[0]);
    const code = `REF-${userId}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const row = await pool.query("insert into referral_codes (user_id, code) values ($1, $2) returning *", [userId, code]);
    res.json(row.rows[0]);
  });

  app.post(api.referrals.apply.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { code } = api.referrals.apply.input.parse(req.body);
      const ref = await pool.query("select * from referral_codes where code = $1 limit 1", [code]);
      if (!ref.rows[0]) return res.status(404).json({ message: "Invalid code" });
      if (Number(ref.rows[0].user_id) === userId) return res.status(400).json({ message: "You cannot use your own code" });
      const row = await pool.query(
        "insert into referrals (referrer_id, referred_user_id, reward_given) values ($1, $2, true) returning *",
        [ref.rows[0].user_id, userId],
      );
      await storage.updateUser(ref.rows[0].user_id, { bookingCreditCents: ((await storage.getUser(ref.rows[0].user_id))?.bookingCreditCents ?? 0) + 500 });
      await storage.updateUser(userId, { bookingCreditCents: ((await storage.getUser(userId))?.bookingCreditCents ?? 0) + 500 });
      res.json(row.rows[0]);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.gallery.list.path, async (req, res) => {
    const barberId = Number.parseInt(req.params.barberId, 10);
    res.setHeader("Cache-Control", "no-store");
    const rows = await pool.query("select * from barber_gallery where barber_id = $1 order by created_at desc", [barberId]);
    res.json(rows.rows);
  });

  app.post(api.gallery.add.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const parsed = api.gallery.add.input.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return res.status(400).json({
          message: issue?.message ?? "Invalid gallery payload",
          field: issue?.path?.join(".") ?? "unknown",
        });
      }
      const { barberId, imageUrl, caption } = parsed.data;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not logged in" });
      if (!["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "admin" && !hasAdminPermission(user, "gallery")) {
        return res.status(403).json({ message: "No access to this section." });
      }

      // Barbers can upload only to their own gallery; admins can upload for any barber.
      const targetBarberId = user.role === "admin" ? barberId : user.id;
      const targetBarberIdNum = Number(targetBarberId);
      if (user.role === "admin" && !Number.isFinite(targetBarberIdNum)) {
        return res.status(400).json({ message: "barberId is required for admin uploads." });
      }
      const targetBarber = await storage.getUser(targetBarberIdNum);
      if (!targetBarber || targetBarber.role !== "barber") {
        return res.status(400).json({ message: "Target barber not found." });
      }

      const row = await pool.query(
        "insert into barber_gallery (barber_id, image_url, caption) values ($1, $2, $3) returning *",
        [targetBarberIdNum, imageUrl, caption ?? null],
      );
      res.status(201).json(row.rows[0]);
    } catch (error: any) {
      console.error("[gallery.add] failed", error);
      const message =
        process.env.NODE_ENV === "development"
          ? error?.message || "Bad Request"
          : "Bad Request";
      res.status(400).json({ message });
    }
  });

  app.patch(api.gallery.update.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid gallery id" });
      const parsed = api.gallery.update.input.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return res.status(400).json({
          message: issue?.message ?? "Invalid gallery payload",
          field: issue?.path?.join(".") ?? "unknown",
        });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not logged in" });
      if (!["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "admin" && !hasAdminPermission(user, "gallery")) {
        return res.status(403).json({ message: "No access to this section." });
      }

      const existing = await pool.query("select * from barber_gallery where id = $1 limit 1", [id]);
      const row = existing.rows[0];
      if (!row) return res.status(404).json({ message: "Gallery post not found" });
      if (user.role === "barber" && Number(row.barber_id) !== Number(user.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { imageUrl, caption } = parsed.data;
      const nextImageUrl = imageUrl ?? row.image_url;
      const nextCaption = caption ?? row.caption;

      const updated = await pool.query(
        "update barber_gallery set image_url = $1, caption = $2 where id = $3 returning *",
        [nextImageUrl, nextCaption, id],
      );
      res.json(updated.rows[0]);
    } catch (error: any) {
      console.error("[gallery.update] failed", error);
      res.status(400).json({ message: process.env.NODE_ENV === "development" ? error?.message || "Bad Request" : "Bad Request" });
    }
  });

  app.delete(api.gallery.remove.path, async (req, res) => {
    const userId = getSessionUserId(req.session.userId);
    if (!userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid gallery id" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not logged in" });
      if (!["admin", "barber"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
      if (user.role === "admin" && !hasAdminPermission(user, "gallery")) {
        return res.status(403).json({ message: "No access to this section." });
      }

      const existing = await pool.query("select * from barber_gallery where id = $1 limit 1", [id]);
      const row = existing.rows[0];
      if (!row) return res.status(404).json({ message: "Gallery post not found" });
      if (user.role === "barber" && Number(row.barber_id) !== Number(user.id)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await pool.query("delete from barber_gallery where id = $1", [id]);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[gallery.delete] failed", error);
      res.status(400).json({ message: process.env.NODE_ENV === "development" ? error?.message || "Bad Request" : "Bad Request" });
    }
  });

  app.get(api.customerTags.list.path, async (_req, res) => {
    const rows = await pool.query("select * from customer_tags order by name asc");
    res.json(rows.rows);
  });

  app.post(api.customerTags.create.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    try {
      const { name } = api.customerTags.create.input.parse(req.body);
      const row = await pool.query("insert into customer_tags (name) values ($1) returning *", [name]);
      res.status(201).json(row.rows[0]);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.post(api.customerTags.assign.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    try {
      const { userId, tagId } = api.customerTags.assign.input.parse(req.body);
      await pool.query("insert into user_tags (user_id, tag_id) values ($1, $2)", [userId, tagId]);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.customerTags.usersByTag.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    const tagId = Number.parseInt(req.params.tagId, 10);
    const rows = await pool.query(
      "select u.* from users u join user_tags ut on ut.user_id = u.id where ut.tag_id = $1 order by u.id desc",
      [tagId],
    );
    res.json(rows.rows);
  });

  app.get(api.campaigns.list.path, async (_req, res) => {
    const rows = await pool.query("select * from marketing_campaigns order by sent_at desc");
    res.json(rows.rows);
  });

  app.post(api.campaigns.send.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "growth");
    if (!admin) return;
    try {
      const { title, message, channel, targetTagId } = api.campaigns.send.input.parse(req.body);
      const campaign = await pool.query(
        "insert into marketing_campaigns (title, message, sent_by_user_id, channel, target_tag_id) values ($1, $2, $3, $4, $5) returning *",
        [title, message, admin.id, channel, targetTagId ?? null],
      );
      const recipients = targetTagId
        ? await pool.query(
            "select u.* from users u join user_tags ut on ut.user_id = u.id where ut.tag_id = $1 and u.role = 'client'",
            [targetTagId],
          )
        : await pool.query("select * from users where role = 'client'");
      for (const r of recipients.rows) {
        if (channel === "email" && r.email) await sendEmail(r.email, title, message);
        if (channel === "sms" && r.phone) await sendSms(r.phone, message);
      }
      await persistAudit(admin.id, "marketing_campaign_sent", { campaignId: campaign.rows[0]?.id, recipients: recipients.rowCount });
      res.status(201).json(campaign.rows[0]);
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.geo.nearest.path, async (req, res) => {
    const lat = Number.parseFloat(String(req.query.lat ?? ""));
    const lng = Number.parseFloat(String(req.query.lng ?? ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "lat and lng query params are required." });
    }
    const branches = await storage.getBranches();
    const withDistance = branches
      .filter((b) => Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude)))
      .map((b) => ({
        ...b,
        distanceKm: haversineKm(lat, lng, Number(b.latitude), Number(b.longitude)),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json(withDistance[0] ?? null);
  });

  app.get(api.cancellationPolicy.get.path, async (_req, res) => {
    const freeCancelHours = Number.parseInt((await storage.getAppSetting("cancellation_free_hours")) ?? "3", 10);
    const lateFee = Number.parseInt((await storage.getAppSetting("cancellation_late_fee")) ?? "10", 10);
    res.json({ freeCancelHours, lateFee });
  });

  app.post(api.cancellationPolicy.set.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "finance");
    if (!admin) return;
    try {
      const { freeCancelHours, lateFee } = api.cancellationPolicy.set.input.parse(req.body);
      await storage.setAppSetting("cancellation_free_hours", String(freeCancelHours));
      await storage.setAppSetting("cancellation_late_fee", String(lateFee));
      await persistAudit(admin.id, "cancellation_policy_updated", { freeCancelHours, lateFee });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Bad Request" });
    }
  });

  app.get(api.audit.list.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "developer");
    if (!admin) return;
    const rows = await pool.query("select * from audit_logs order by timestamp desc limit 1000");
    res.json(rows.rows);
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

  app.get(api.landingMedia.get.path, async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const raw = await storage.getAppSetting("landing_media_boxes");
      if (!raw) return res.json({ photos: [], videos: [] });
      const parsed = JSON.parse(raw);
      const photosRaw = Array.isArray((parsed as any)?.photos) ? (parsed as any).photos : [];
      const videosRaw = Array.isArray((parsed as any)?.videos) ? (parsed as any).videos : [];
      const photos = photosRaw
        .map((p: any, idx: number) => ({
          id: String(p?.id ?? `photo-${idx}`),
          title: String(p?.title ?? ""),
          imageUrl: String(p?.imageUrl ?? p?.image_url ?? p?.url ?? ""),
        }))
        .filter((p: any) => p.imageUrl.trim().length > 0);
      const videos = videosRaw
        .map((v: any, idx: number) => ({
          id: String(v?.id ?? `video-${idx}`),
          title: String(v?.title ?? ""),
          videoUrl: String(v?.videoUrl ?? v?.video_url ?? v?.url ?? ""),
        }))
        .filter((v: any) => v.videoUrl.trim().length > 0);
      return res.json({ photos, videos });
    } catch {
      return res.json({ photos: [], videos: [] });
    }
  });

  app.post(api.landingMedia.save.path, async (req, res) => {
    const admin = await requireAdminPermission(req, res, "gallery");
    if (!admin) return;
    try {
      const input = api.landingMedia.save.input.parse(req.body);
      await storage.setAppSetting("landing_media_boxes", JSON.stringify(input));
      await persistAudit(admin.id, "landing_media_saved", { photos: input.photos.length, videos: input.videos.length });
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ message: "Bad Request" });
    }
  });

  return httpServer;
}

