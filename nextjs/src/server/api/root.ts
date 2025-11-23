import { dashboardRouter } from "./routers/dashboard";
import { router } from "../trpc/init";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here
 */
export const appRouter = router({
  dashboard: dashboardRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
