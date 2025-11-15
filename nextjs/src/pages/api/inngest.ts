import { aggregatorRun } from "@/inngest/aggregator";
import { inngestClient } from "@/lib/clients/inngest";
import { serve } from "inngest/next";

export const config = {
  maxDuration: 720, // 12 minutes
};

export default serve({
  client: inngestClient,
  functions: [
    // Aggregator
    aggregatorRun,
  ],
});
