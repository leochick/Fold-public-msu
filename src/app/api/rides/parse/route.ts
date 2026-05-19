export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { mockRidesParse } from "@/lib/demo-data";
import { ridesParseBody } from "@/lib/contracts/rides";
import { parseRides } from "@/server/rides";

export const POST = withAuth(
  async ({ body }) =>
    parseRides({
      sessionId: body.sessionId,
      text: body.text,
      vehicles: body.vehicles,
      enforceGenderRule: body.enforceGenderRule === true,
    }),
  {
    bodySchema: ridesParseBody,
    demoMock: () => mockRidesParse(),
  }
);
