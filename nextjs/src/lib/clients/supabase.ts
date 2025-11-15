import { Database } from "@shared-types/database.types";
import { createClient } from "@supabase/supabase-js";

// Never expose this to the client
export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
