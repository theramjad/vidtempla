import { auth } from "@/lib/auth";
import { toNodeHandler } from "better-auth/node";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default toNodeHandler(auth.handler) as (
  req: NextApiRequest,
  res: NextApiResponse
) => void;
