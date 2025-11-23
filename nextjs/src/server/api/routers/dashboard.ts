import { router } from "@/server/trpc/init";
import { youtubeRouter } from "./dashboard/youtube";
import { billingRouter } from "./dashboard/billing";
import { aiRouter } from "./dashboard/ai";

// Dashboard API
export const dashboardRouter = router({
  youtube: youtubeRouter,
  billing: billingRouter,
  ai: aiRouter,
});

