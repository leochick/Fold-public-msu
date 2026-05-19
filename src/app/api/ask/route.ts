export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { mockAskQuery } from "@/lib/demo-data";
import { askBody } from "@/lib/contracts/query";
import { ask } from "@/server/query";

export const POST = withAuth(
  async ({ body }) => ask(body.text),
  {
    bodySchema: askBody,
    demoMock: () => mockAskQuery(),
  }
);
