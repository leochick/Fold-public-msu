export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { intakeParseBody } from "@/lib/contracts/intake";
import { parseIntake } from "@/server/intake";

export const POST = withAuth(
  async ({ body }) => parseIntake(body.text),
  { bodySchema: intakeParseBody }
);
