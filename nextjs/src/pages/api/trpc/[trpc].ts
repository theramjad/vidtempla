import { createNextApiHandler } from "@trpc/server/adapters/next";
import { appRouter } from "@/server/api/root";
import { db } from "@/db";
import { auth } from "@/lib/auth";

export default createNextApiHandler({
  router: appRouter,
  createContext: async ({ req }) => {
    // Convert Node.js IncomingHttpHeaders to Web API Headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
    }

    const session = await auth.api.getSession({ headers });

    return {
      db,
      user: session?.user ?? null,
    };
  },
});
