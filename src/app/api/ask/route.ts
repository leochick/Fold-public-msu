export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { askBody } from "@/lib/contracts/query";
import { ask } from "@/server/query";

export const POST = withAuth(
  async ({ body }) => ask(body.text),
  { bodySchema: askBody }
);
