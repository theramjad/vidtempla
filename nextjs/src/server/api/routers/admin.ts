import { createTRPCRouter } from "@/server/api/trpc";
import { youtubeRouter } from "./admin/youtube";

// Admin API
export const adminRouter = createTRPCRouter({
  youtube: youtubeRouter,
}); 
