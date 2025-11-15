import { createTRPCRouter } from "@/server/api/trpc";
import { twitterRouter } from "./admin/twitter";
import { youtubeRouter } from "./admin/youtube";

// Admin API
export const adminRouter = createTRPCRouter({
  twitter: twitterRouter,
  youtube: youtubeRouter,
}); 
