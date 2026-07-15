export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { staffAllocationInsightsBody } from "@/lib/contracts/staff-allocation";
import { staffAllocationInsights } from "@/server/staff-allocation";

export const POST = withAuth(
  async ({ body }) => staffAllocationInsights(body),
  { bodySchema: staffAllocationInsightsBody }
);
