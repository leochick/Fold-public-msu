export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { nlQueryBody } from "@/lib/contracts/query";
import { nlQuery } from "@/server/query";

export const POST = withAuth(
  async ({ body }) => nlQuery(body.query),
  { bodySchema: nlQueryBody }
);
