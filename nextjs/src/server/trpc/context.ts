import { db, type Database } from "@/db";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export type Context = {
  db: Database;
  supabase: SupabaseClient;
  user: User | null;
};

export async function createContext(): Promise<Context> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    db,
    supabase,
    user,
  };
}
