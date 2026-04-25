import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { creditResetWorkflow } from "@/workflows/credit-reset";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await start(creditResetWorkflow);

  return NextResponse.json({ runId: run.runId });
}
