import { createTRPCRouter } from "@/server/api/trpc";
import { youtubeRouter } from "./dashboard/youtube";
import { billingRouter } from "./dashboard/billing";
import { aiRouter } from "./dashboard/ai";

// Dashboard API
export const dashboardRouter = createTRPCRouter({
  youtube: youtubeRouter,
  billing: billingRouter,
  ai: aiRouter,
});
 
