import { withAuth } from "@/lib/http";
import { ridesValidateBody } from "@/lib/contracts/rides";
import { validateRides } from "@/server/rides";

export const POST = withAuth(
  async ({ body }) =>
    validateRides({
      riders: body.riders,
      vehicles: body.vehicles,
      assignments: body.assignments,
      enforceGenderRule: body.enforceGenderRule !== false,
    }),
  { bodySchema: ridesValidateBody }
);
