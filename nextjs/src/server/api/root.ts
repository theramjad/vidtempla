import { dashboardRouter } from "./routers/dashboard";
import { siteAdminRouter } from "./routers/admin";
import { router } from "../trpc/init";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here
 */
export const appRouter = router({
  dashboard: dashboardRouter,
  admin: siteAdminRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
