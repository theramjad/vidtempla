import { db, type Database } from "@/db";
import { auth, type Session } from "@/lib/auth";

export type Context = {
  db: Database;
  user: Session["user"] | null;
};

export async function createContext({
  req,
}: {
  req: Request;
}): Promise<Context> {
  const session = await auth.api.getSession({ headers: req.headers });

  return {
    db,
    user: session?.user ?? null,
  };
}
