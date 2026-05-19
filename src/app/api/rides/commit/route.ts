import { withAuth } from "@/lib/http";
import { ridesCommitBody } from "@/lib/contracts/rides";
import { commitRides } from "@/server/rides";

export const POST = withAuth(
  async ({ user, body }) =>
    commitRides(user.id, {
      sessionId: body.sessionId,
      enforceGenderRule: body.enforceGenderRule !== false,
      vehicles: body.vehicles,
      riders: body.riders,
      assignments: body.assignments,
    }),
  { bodySchema: ridesCommitBody }
);
