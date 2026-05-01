import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { scheduledSyncWorkflow } from "@/workflows/scheduled-sync";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const run = await start(scheduledSyncWorkflow);

  return NextResponse.json({ runId: run.runId });
}
