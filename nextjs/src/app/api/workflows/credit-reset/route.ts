import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { creditResetWorkflow } from "@/workflows/credit-reset";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const run = await start(creditResetWorkflow);

  return NextResponse.json({ runId: run.runId });
}
