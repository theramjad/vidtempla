export const BRAND_COLOR = "#0fbf91";

export const BUTTON_STYLE =
  "display:inline-block;background-color:#0fbf91;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;";

export const CARD_STYLE =
  "background-color:#f9fafb;border-radius:8px;padding:32px;margin-bottom:24px;";

export const MUTED_TEXT_STYLE = "color:#9ca3af;font-size:13px;";

const BODY_STYLE =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#ffffff;";

interface RenderEmailOptions {
  title: string;
  bodyHtml: string;
}

export function renderEmail({ title, bodyHtml }: RenderEmailOptions): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${BODY_STYLE}">
  <div style="${CARD_STYLE}">
    ${bodyHtml}
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="${MUTED_TEXT_STYLE}margin:0;">This is a transactional email requested by you. There is no need to unsubscribe. If you did not request this email, please ignore it.</p>
  <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
    Ray Amjad LTD<br />
    Lytchett House, 13 Freeland Park, Wareham Road, Poole, Dorset, BH16 6FA
  </p>
</body>
</html>
  `.trim();
}
