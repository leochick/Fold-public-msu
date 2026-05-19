export const maxDuration = 60;

import { withAuth, httpErr } from "@/lib/http";
import { eventInsightsSingleBody } from "@/lib/contracts/events";
import { singleEventInsights } from "@/server/events";

export const POST = withAuth(
  async ({ body }) => {
    if (body.stats.total < 1) throw httpErr.badRequest("no attendees");
    return singleEventInsights(body.stats);
  },
  { bodySchema: eventInsightsSingleBody }
);
