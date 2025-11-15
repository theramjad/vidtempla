import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "../../../env/server.mjs";
import { createTRPCContext } from "../../../server/api/trpc";
import { appRouter } from "../../../server/api/root";

// Increase limit of body size as the book content is large
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb",
    },
    responseLimit: "4mb",
  },
};

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
          );
          console.error("Error:", error);
        }
      : undefined,
});
