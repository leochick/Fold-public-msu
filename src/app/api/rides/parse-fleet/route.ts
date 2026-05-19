export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { mockRidesParseFleet } from "@/lib/demo-data";
import { ridesFleetBody } from "@/lib/contracts/rides";
import { parseFleet } from "@/server/rides";

export const POST = withAuth(
  async ({ body }) => parseFleet(body.text),
  {
    bodySchema: ridesFleetBody,
    demoMock: () => mockRidesParseFleet(),
  }
);
