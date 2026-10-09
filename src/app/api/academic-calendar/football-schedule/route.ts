export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { footballScheduleBody } from "@/lib/contracts/academic-calendar";
import { populateFootballSchedule } from "@/server/football-schedule";

export const POST = withAuth(async ({ body }) => populateFootballSchedule(body.academicYearId), {
  bodySchema: footballScheduleBody,
});
