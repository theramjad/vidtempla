const SUPER_ADMIN_EMAILS = ["r@rayamjad.com"];

export function isSuperAdmin(email: string | undefined | null): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email);
}
