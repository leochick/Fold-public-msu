export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { mockParseEventBatch } from "@/lib/demo-data";
import { parseEventBatchBody } from "@/lib/contracts/events";
import { parseEventBatch } from "@/server/events";

export const POST = withAuth(
  async ({ body }) => parseEventBatch(body),
  {
    bodySchema: parseEventBatchBody,
    demoMock: () => mockParseEventBatch(),
  }
);
