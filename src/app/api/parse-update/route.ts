export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { mockParseUpdate } from "@/lib/demo-data";
import { parseUpdateBody } from "@/lib/contracts/students";
import { parseUpdate } from "@/server/students";

export const POST = withAuth(
  async ({ body }) => parseUpdate(body.text),
  {
    bodySchema: parseUpdateBody,
    demoMock: () => mockParseUpdate(),
  }
);
