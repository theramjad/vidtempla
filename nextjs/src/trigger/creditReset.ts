import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/db";
import { userCredits } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getUserPlanTier, upsertCredits } from "@/lib/plan-limits";
import { PLAN_CONFIG } from "@/lib/stripe";

export const creditReset = schedules.task({
  id: "credit-reset",
  cron: "0 */6 * * *",
  run: async () => {
    const expiredRows = await db
      .select({ userId: userCredits.userId })
      .from(userCredits)
      .where(sql`${userCredits.periodEnd} <= NOW()`);

    for (const row of expiredRows) {
      const tier = await getUserPlanTier(row.userId, db);
      const allocation = PLAN_CONFIG[tier].monthlyCredits;
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      await upsertCredits(row.userId, allocation, now, periodEnd);
    }

    logger.info("Credit reset complete", { usersReset: expiredRows.length });

    return {
      success: true,
      usersReset: expiredRows.length,
      timestamp: new Date().toISOString(),
    };
  },
});
