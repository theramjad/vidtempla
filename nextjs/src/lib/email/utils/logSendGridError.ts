export function logSendGridError(context: string, to: string, err: unknown): void {
  // SendGrid SDK attaches the actionable reason at err.response.body.errors;
  // the top-level Error message alone usually just says "Forbidden" / "Unauthorized".
  const anyErr = err as {
    code?: number | string;
    message?: string;
    response?: { statusCode?: number; body?: { errors?: Array<{ message?: string; field?: string }> } };
  };
  const status = anyErr?.response?.statusCode ?? anyErr?.code;
  const reasons = anyErr?.response?.body?.errors
    ?.map((e) => `${e.field ?? ""}: ${e.message ?? ""}`.trim())
    .join("; ");
  console.error("[sendgrid] failed", {
    context,
    to,
    status,
    message: anyErr?.message,
    reasons,
    keyPrefix: process.env.SENDGRID_API_KEY?.slice(0, 7),
  });
}
