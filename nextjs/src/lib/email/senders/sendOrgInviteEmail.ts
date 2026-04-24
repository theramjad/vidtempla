import { sendEmail } from "../utils/sendEmail";
import { escapeHtml } from "../utils/escapeHtml";
import { BRAND_COLOR, BUTTON_STYLE, renderEmail } from "../templates/layout";

interface SendOrgInviteEmailParams {
  email: string;
  inviteUrl: string;
  inviterName: string;
  orgName: string;
}

export async function sendOrgInviteEmail({
  email,
  inviteUrl,
  inviterName,
  orgName,
}: SendOrgInviteEmailParams): Promise<void> {
  const safeInviter = escapeHtml(inviterName);
  const safeOrg = escapeHtml(orgName);
  const subject = `You've been invited to ${orgName} on VidTempla`;

  const bodyHtml = `
    <h1 style="color:${BRAND_COLOR};margin-top:0;margin-bottom:16px;font-size:24px;">You're invited!</h1>
    <p style="margin-bottom:16px;color:#4b5563;font-size:16px;">
      <strong>${safeInviter}</strong> has invited you to join <strong>${safeOrg}</strong> on VidTempla.
    </p>
    <p style="margin-bottom:24px;color:#4b5563;font-size:16px;">
      Click the button below to accept the invitation and get started.
    </p>
    <p style="text-align:center;margin:32px 0;">
      <a href="${inviteUrl}" style="${BUTTON_STYLE}">Accept invitation</a>
    </p>
    <p style="color:#9ca3af;font-size:13px;margin-bottom:0;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  `;

  await sendEmail({
    to: email,
    subject,
    html: renderEmail({ title: subject, bodyHtml }),
    emailType: "org_invite",
  });
}
