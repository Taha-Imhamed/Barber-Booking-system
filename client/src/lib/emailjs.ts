import emailjs from "@emailjs/browser";

type ReservationEmailPayload = {
  toEmail: string;
  toName: string;
  barberName: string;
  serviceName: string;
  appointmentDateTime: string;
  branchName: string;
};

function getEmailJsConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey };
}

export async function sendReservationConfirmationEmail(payload: ReservationEmailPayload): Promise<boolean> {
  const config = getEmailJsConfig();
  if (!config || !payload.toEmail) return false;

  await emailjs.send(
    config.serviceId,
    config.templateId,
    {
      to_email: payload.toEmail,
      to_name: payload.toName,
      barber_name: payload.barberName,
      service_name: payload.serviceName,
      appointment_datetime: payload.appointmentDateTime,
      branch_name: payload.branchName,
      message: `Your reservation is submitted for ${payload.appointmentDateTime}.`,
    },
    { publicKey: config.publicKey },
  );

  return true;
}
