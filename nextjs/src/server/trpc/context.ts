import { db, type Database } from "@/db";
import { auth, type Session } from "@/lib/auth";

export type Context = {
  db: Database;
  user: Session["user"] | null;
  organizationId: string | null;
};

export async function createContext({
  req,
}: {
  req: Request;
}): Promise<Context> {
  const session = await auth.api.getSession({ headers: req.headers });
  const organizationId =
    req.headers.get("x-organization-id") ??
    session?.session?.activeOrganizationId ??
    null;

  return {
    db,
    user: session?.user ?? null,
    organizationId,
  };
}
