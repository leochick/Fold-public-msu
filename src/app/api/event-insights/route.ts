export const maxDuration = 60;

import { withAuth, httpErr } from "@/lib/http";
import { mockInsights } from "@/lib/demo-data";
import { eventInsightsBody } from "@/lib/contracts/events";
import { aggregatesInsights } from "@/server/events";

export const POST = withAuth(
  async ({ body }) => {
    if (body.aggregates.totalEvents < 3) {
      throw httpErr.badRequest("not enough events for insights");
    }
    return aggregatesInsights(body.aggregates);
  },
  {
    bodySchema: eventInsightsBody,
    demoMock: () => ({ insights: mockInsights() }),
  }
);
