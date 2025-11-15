import { createTRPCRouter } from "@/server/api/trpc";
import { twitterRouter } from "./admin/twitter";

// Admin API
export const adminRouter = createTRPCRouter({
  twitter: twitterRouter,
}); 
