import cron from "node-cron";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { sendEmail, sendSms } from "./notifier";
import { pool } from "./db";

let started = false;

async function hasReminder(appointmentId: number, reminderType: "24h" | "1h"): Promise<boolean> {
  const result = await pool.query(
    "select 1 from appointment_reminders where appointment_id = $1 and reminder_type = $2 limit 1",
    [appointmentId, reminderType],
  );
  return (result.rowCount ?? 0) > 0;
}

async function markReminder(appointmentId: number, reminderType: "24h" | "1h", channel: "email" | "sms") {
  await pool.query(
    "insert into appointment_reminders (appointment_id, reminder_type, channel) values ($1, $2, $3)",
    [appointmentId, reminderType, channel],
  );
}

async function sendAppointmentReminders() {
  const appointments = await storage.getAppointments();
  const users = await storage.getUsers();
  const userById = new Map(users.map((u) => [u.id, u]));

  for (const appointment of appointments) {
    if (!["pending", "accepted"].includes(appointment.status)) continue;

    const startMs = new Date(appointment.appointmentDate).getTime();
    const diffHours = (startMs - Date.now()) / (1000 * 60 * 60);
    const client = appointment.clientId ? userById.get(appointment.clientId) : undefined;
    const toEmail = appointment.guestEmail || client?.email;
    const toPhone = appointment.guestPhone || client?.phone;

    if (diffHours <= 24.2 && diffHours >= 23.6 && !(await hasReminder(appointment.id, "24h"))) {
      const message = `Reminder: your appointment is in 24 hours at ${new Date(appointment.appointmentDate).toLocaleString()}.`;
      if (toEmail) {
        await sendEmail(toEmail, "Appointment Reminder (24h)", message);
        await markReminder(appointment.id, "24h", "email");
      } else if (toPhone) {
        await sendSms(toPhone, message);
        await markReminder(appointment.id, "24h", "sms");
      }
    }

    if (diffHours <= 1.2 && diffHours >= 0.6 && !(await hasReminder(appointment.id, "1h"))) {
      const message = `Reminder: your appointment is in 1 hour at ${new Date(appointment.appointmentDate).toLocaleString()}.`;
      if (toEmail) {
        await sendEmail(toEmail, "Appointment Reminder (1h)", message);
        await markReminder(appointment.id, "1h", "email");
      } else if (toPhone) {
        await sendSms(toPhone, message);
        await markReminder(appointment.id, "1h", "sms");
      }
    }
  }
}

async function runDailyBackup() {
  const [users, appointments, services, branches] = await Promise.all([
    storage.getUsers(),
    storage.getAppointments(),
    storage.getServices(),
    storage.getBranches(),
  ]);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dir = path.resolve(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `backup_${yyyy}_${mm}_${dd}.sql`);

  const dump = {
    generatedAt: now.toISOString(),
    users,
    appointments,
    services,
    branches,
  };

  fs.writeFileSync(filePath, JSON.stringify(dump, null, 2), "utf8");
}

export function startSchedulers() {
  if (started) return;
  started = true;

  cron.schedule("*/5 * * * *", () => {
    void sendAppointmentReminders().catch((err) => {
      console.error("[scheduler.reminders]", err);
    });
  });

  cron.schedule("0 2 * * *", () => {
    void runDailyBackup().catch((err) => {
      console.error("[scheduler.backup]", err);
    });
  });
}
