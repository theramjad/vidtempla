import { createTRPCRouter } from "@/server/api/trpc";
import { youtubeRouter } from "./admin/youtube";
import { billingRouter } from "./admin/billing";

// Admin API
export const adminRouter = createTRPCRouter({
  youtube: youtubeRouter,
  billing: billingRouter,
}); 
