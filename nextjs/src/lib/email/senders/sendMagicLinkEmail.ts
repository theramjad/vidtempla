import { sendEmail } from "../utils/sendEmail";
import { BRAND_COLOR, BUTTON_STYLE, renderEmail } from "../templates/layout";

interface SendMagicLinkEmailParams {
  email: string;
  url: string;
}

export async function sendMagicLinkEmail({
  email,
  url,
}: SendMagicLinkEmailParams): Promise<void> {
  const subject = "Sign in to VidTempla";
  const bodyHtml = `
    <h1 style="color:${BRAND_COLOR};margin-top:0;margin-bottom:16px;font-size:24px;">Sign in to VidTempla</h1>
    <p style="margin-bottom:16px;color:#4b5563;font-size:16px;">Click the button below to sign in to your account. This link will expire shortly.</p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${url}" style="${BUTTON_STYLE}">Sign in to VidTempla</a>
    </p>
    <p style="color:#9ca3af;font-size:13px;margin-bottom:0;">
      If you didn't request this email, you can safely ignore it.
    </p>
  `;

  await sendEmail({
    to: email,
    subject,
    html: renderEmail({ title: subject, bodyHtml }),
    emailType: "magic_link",
  });
}
