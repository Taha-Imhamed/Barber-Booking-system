type NotifyResult = {
  sent: boolean;
  provider: string;
  error?: string;
};

type MultiNotifyResult = {
  email: NotifyResult;
  sms: NotifyResult;
};

type TemplateParams = Record<string, string | number | boolean | null | undefined>;

let diagnosticsLogged = false;

function resolveEmailJsTemplateId(templateParams?: TemplateParams): string | undefined {
  const eventType = String(templateParams?.event_type ?? "").trim();
  if (eventType === "reservation_requested") {
    return (
      process.env.EMAILJS_TEMPLATE_ID_WELCOME ||
      process.env.VITE_EMAILJS_TEMPLATE_ID_WELCOME ||
      process.env.EMAILJS_TEMPLATE_ID ||
      process.env.VITE_EMAILJS_TEMPLATE_ID
    );
  }
  if (eventType === "reservation_confirmed") {
    return (
      process.env.EMAILJS_TEMPLATE_ID_CONFIRMED ||
      process.env.VITE_EMAILJS_TEMPLATE_ID_CONFIRMED ||
      process.env.EMAILJS_TEMPLATE_ID ||
      process.env.VITE_EMAILJS_TEMPLATE_ID
    );
  }
  return process.env.EMAILJS_TEMPLATE_ID || process.env.VITE_EMAILJS_TEMPLATE_ID;
}

function getEmailProviderName(): string {
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID) return "emailjs";
  return "console";
}

export function initNotifierDiagnostics(): void {
  if (diagnosticsLogged) return;
  diagnosticsLogged = true;

  const provider = getEmailProviderName();
  console.log("[notifier] email provider:", provider);

  if (provider === "console") {
    console.warn(
      "[notifier] No email provider configured. Set BREVO_API_KEY+BREVO_SENDER_EMAIL, or RESEND_API_KEY+RESEND_SENDER_EMAIL, or EmailJS vars.",
    );
  }
}

async function sendViaBrevo(to: string, subject: string, text: string): Promise<NotifyResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Barber Booking";
  if (!apiKey || !senderEmail) {
    return { sent: false, provider: "brevo", error: "Missing BREVO_API_KEY or BREVO_SENDER_EMAIL" };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return { sent: false, provider: "brevo", error: `HTTP ${response.status}${details ? `: ${details}` : ""}` };
  }
  return { sent: true, provider: "brevo" };
}

async function sendViaResend(to: string, subject: string, text: string): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.RESEND_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    return { sent: false, provider: "resend", error: "Missing RESEND_API_KEY or RESEND_SENDER_EMAIL" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: senderEmail,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return { sent: false, provider: "resend", error: `HTTP ${response.status}${details ? `: ${details}` : ""}` };
  }
  return { sent: true, provider: "resend" };
}

async function sendViaEmailJs(to: string, subject: string, text: string, templateParams?: TemplateParams): Promise<NotifyResult> {
  const serviceId = process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = resolveEmailJsTemplateId(templateParams);
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || process.env.VITE_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY || process.env.VITE_EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey) {
    return { sent: false, provider: "emailjs", error: "Missing EmailJS config" };
  }

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      ...(privateKey ? { accessToken: privateKey } : {}),
      template_params: {
        to_email: to,
        to_name: to.split("@")[0] || "Client",
        user_email: to,
        email: to,
        recipient_email: to,
        recipient: to,
        to,
        subject,
        title: subject,
        message: text,
        content: text,
        ...(templateParams ?? {}),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return { sent: false, provider: "emailjs", error: `HTTP ${response.status}${details ? `: ${details}` : ""}` };
  }
  return { sent: true, provider: "emailjs" };
}

export async function sendEmail(to: string, subject: string, text: string, templateParams?: TemplateParams): Promise<NotifyResult> {
  const normalizedTo = String(to ?? "").trim();
  if (!normalizedTo) return { sent: false, provider: "none", error: "No recipient email" };

  initNotifierDiagnostics();

  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo(normalizedTo, subject, text);
  }
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(normalizedTo, subject, text);
  }
  if (process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID) {
    return sendViaEmailJs(normalizedTo, subject, text, templateParams);
  }

  console.log("[email:console]", { to: normalizedTo, subject, text });
  return { sent: false, provider: "console", error: "No provider configured" };
}

export async function sendSms(to: string, message: string): Promise<NotifyResult> {
  if (!to) return { sent: false, provider: "none", error: "No recipient phone" };

  const textbeltKey = process.env.TEXTBELT_API_KEY;
  if (!textbeltKey) {
    console.log("[sms:console]", { to, message });
    return { sent: false, provider: "console", error: "No provider configured" };
  }

  const body = new URLSearchParams();
  body.set("phone", to);
  body.set("message", message);
  body.set("key", textbeltKey);

  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!response.ok || !payload?.success) {
    return { sent: false, provider: "textbelt", error: payload?.error || `HTTP ${response.status}` };
  }
  return { sent: true, provider: "textbelt" };
}

export async function sendAppointmentUpdateNotification(
  params: { email?: string | null; phone?: string | null; message: string; subject: string },
): Promise<MultiNotifyResult> {
  const [email, sms] = await Promise.all([
    params.email ? sendEmail(params.email, params.subject, params.message) : Promise.resolve({ sent: false, provider: "none", error: "No email" }),
    params.phone ? sendSms(params.phone, params.message) : Promise.resolve({ sent: false, provider: "none", error: "No phone" }),
  ]);
  return { email, sms };
}
