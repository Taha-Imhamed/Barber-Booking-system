import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { initNotifierDiagnostics } from "./notifier";
import { startSchedulers } from "./scheduler";

const app = express();
const httpServer = createServer(app);

// Required when running behind reverse proxies (Render/Vercel) so secure cookies work.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const PgSessionStore = connectPgSimple(session);

app.use(
  session({
    store: new PgSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again in a minute." },
  }),
);

async function ensureRuntimeSchema() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available boolean`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_hours text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS no_show_count integer`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_flagged_no_show boolean`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_credit_cents integer`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_permissions text`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted boolean`);
  await pool.query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude real`);
  await pool.query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude real`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS proposed_date timestamp`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS proposed_by_role text`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS proposed_status text`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_deleted boolean`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method text`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status text`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prepaid_amount integer`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_reference text`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_duration_minutes integer`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS total_price integer`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at timestamp`);
  await pool.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS no_show_marked_at timestamp`);
  await pool.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_deleted boolean`);
  await pool.query(`UPDATE users SET auth_provider = COALESCE(auth_provider, 'local')`);
  await pool.query(`UPDATE users SET email_verified = COALESCE(email_verified, false)`);
  await pool.query(`UPDATE users SET is_available = COALESCE(is_available, true)`);
  await pool.query(`UPDATE users SET unavailable_hours = COALESCE(unavailable_hours, '[]')`);
  await pool.query(`UPDATE users SET no_show_count = COALESCE(no_show_count, 0)`);
  await pool.query(`UPDATE users SET is_flagged_no_show = COALESCE(is_flagged_no_show, false)`);
  await pool.query(`UPDATE users SET booking_credit_cents = COALESCE(booking_credit_cents, 0)`);
  await pool.query(`UPDATE users SET admin_permissions = COALESCE(admin_permissions, '[]')`);
  await pool.query(`UPDATE users SET is_deleted = COALESCE(is_deleted, false)`);
  await pool.query(`UPDATE users SET email_verified = true WHERE role IN ('admin', 'barber')`);
  await pool.query(`ALTER TABLE users ALTER COLUMN auth_provider SET DEFAULT 'local'`);
  await pool.query(`ALTER TABLE users ALTER COLUMN auth_provider SET NOT NULL`);
  await pool.query(`ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false`);
  await pool.query(`ALTER TABLE users ALTER COLUMN is_available SET DEFAULT true`);
  await pool.query(`ALTER TABLE users ALTER COLUMN unavailable_hours SET DEFAULT '[]'`);
  await pool.query(`ALTER TABLE users ALTER COLUMN no_show_count SET DEFAULT 0`);
  await pool.query(`ALTER TABLE users ALTER COLUMN is_flagged_no_show SET DEFAULT false`);
  await pool.query(`ALTER TABLE users ALTER COLUMN booking_credit_cents SET DEFAULT 0`);
  await pool.query(`ALTER TABLE users ALTER COLUMN admin_permissions SET DEFAULT '[]'`);
  await pool.query(`ALTER TABLE users ALTER COLUMN is_deleted SET DEFAULT false`);
  await pool.query(`UPDATE appointments SET proposed_status = COALESCE(proposed_status, 'none')`);
  await pool.query(`UPDATE appointments SET is_deleted = COALESCE(is_deleted, false)`);
  await pool.query(`UPDATE appointments SET payment_method = COALESCE(payment_method, 'cash_on_arrival')`);
  await pool.query(`UPDATE appointments SET payment_status = COALESCE(payment_status, 'unpaid')`);
  await pool.query(`UPDATE appointments SET prepaid_amount = COALESCE(prepaid_amount, 0)`);
  await pool.query(`UPDATE services SET is_deleted = COALESCE(is_deleted, false)`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN proposed_status SET DEFAULT 'none'`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN is_deleted SET DEFAULT false`);
  await pool.query(`ALTER TABLE services ALTER COLUMN is_deleted SET DEFAULT false`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN payment_method SET DEFAULT 'cash_on_arrival'`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN payment_status SET DEFAULT 'unpaid'`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN prepaid_amount SET DEFAULT 0`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN payment_method SET NOT NULL`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN payment_status SET NOT NULL`);
  await pool.query(`ALTER TABLE appointments ALTER COLUMN prepaid_amount SET NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users (google_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      token text NOT NULL UNIQUE,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_messages (
      id serial PRIMARY KEY,
      appointment_id integer NOT NULL REFERENCES appointments(id),
      admin_user_id integer NOT NULL REFERENCES users(id),
      to_email text,
      to_phone text,
      message text NOT NULL,
      sent_via_email boolean DEFAULT false,
      sent_via_sms boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment_earnings (
      id serial PRIMARY KEY,
      appointment_id integer NOT NULL UNIQUE REFERENCES appointments(id),
      barber_id integer NOT NULL REFERENCES users(id),
      branch_id integer NOT NULL REFERENCES branches(id),
      service_price integer NOT NULL,
      tip_amount integer DEFAULT 0,
      total_amount integer NOT NULL,
      earned_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guest_notifications (
      id serial PRIMARY KEY,
      guest_phone text NOT NULL,
      appointment_id integer NOT NULL REFERENCES appointments(id),
      message text NOT NULL,
      is_read boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id serial PRIMARY KEY,
      title text NOT NULL,
      amount integer NOT NULL,
      branch_id integer REFERENCES branches(id),
      created_by_user_id integer NOT NULL REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id serial PRIMARY KEY,
      name text NOT NULL,
      mode text NOT NULL DEFAULT 'text_numbers',
      created_by_user_id integer NOT NULL REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES chat_groups(id),
      user_id integer NOT NULL REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES chat_groups(id),
      user_id integer NOT NULL REFERENCES users(id),
      content text NOT NULL,
      numeric_value integer,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id serial PRIMARY KEY,
      key text NOT NULL UNIQUE,
      value text NOT NULL,
      updated_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment_services (
      id serial PRIMARY KEY,
      appointment_id integer NOT NULL REFERENCES appointments(id),
      service_id integer NOT NULL REFERENCES services(id),
      duration_minutes integer NOT NULL,
      price integer NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment_reminders (
      id serial PRIMARY KEY,
      appointment_id integer NOT NULL REFERENCES appointments(id),
      reminder_type text NOT NULL,
      channel text NOT NULL DEFAULT 'email',
      sent_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id serial PRIMARY KEY,
      barber_id integer NOT NULL REFERENCES users(id),
      client_id integer NOT NULL REFERENCES users(id),
      appointment_id integer NOT NULL REFERENCES appointments(id),
      rating integer NOT NULL,
      comment text,
      is_approved boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id serial PRIMARY KEY,
      service_id integer NOT NULL REFERENCES services(id),
      date timestamp NOT NULL,
      client_id integer NOT NULL REFERENCES users(id),
      status text NOT NULL DEFAULT 'waiting',
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id serial PRIMARY KEY,
      product_name text NOT NULL,
      stock_quantity integer NOT NULL DEFAULT 0,
      price integer NOT NULL DEFAULT 0,
      last_updated timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_sales (
      id serial PRIMARY KEY,
      inventory_id integer NOT NULL REFERENCES inventory(id),
      quantity integer NOT NULL,
      total_amount integer NOT NULL,
      sold_by_user_id integer NOT NULL REFERENCES users(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      code text NOT NULL UNIQUE,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id serial PRIMARY KEY,
      referrer_id integer NOT NULL REFERENCES users(id),
      referred_user_id integer NOT NULL REFERENCES users(id),
      reward_given boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS barber_gallery (
      id serial PRIMARY KEY,
      barber_id integer NOT NULL REFERENCES users(id),
      image_url text NOT NULL,
      caption text,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id serial PRIMARY KEY,
      user_id integer REFERENCES users(id),
      action text NOT NULL,
      metadata text,
      timestamp timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_tags (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_tags (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      tag_id integer NOT NULL REFERENCES customer_tags(id),
      created_at timestamp DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id serial PRIMARY KEY,
      title text NOT NULL,
      message text NOT NULL,
      sent_by_user_id integer NOT NULL REFERENCES users(id),
      channel text NOT NULL DEFAULT 'email',
      target_tag_id integer REFERENCES customer_tags(id),
      sent_at timestamp DEFAULT now()
    )
  `);
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  initNotifierDiagnostics();
  await ensureRuntimeSchema();
  startSchedulers();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();



