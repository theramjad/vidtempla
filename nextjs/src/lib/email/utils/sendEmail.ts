import sgMail from "@sendgrid/mail";
import { logSendGridError } from "./logSendGridError";

export type EmailType = "magic_link" | "org_invite";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  from?: string;
}

const DEFAULT_FROM = "VidTempla <noreply@vidtempla.com>";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, html, emailType, from } = options;

  try {
    await sgMail.send({
      from: from ?? DEFAULT_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    logSendGridError(emailType, to, err);
    throw err;
  }
}
