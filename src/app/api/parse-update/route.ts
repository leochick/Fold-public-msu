export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { parseUpdateBody } from "@/lib/contracts/students";
import { parseUpdate } from "@/server/students";

export const POST = withAuth(
  async ({ body }) => parseUpdate(body.text),
  { bodySchema: parseUpdateBody }
);
