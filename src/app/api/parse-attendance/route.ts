export const maxDuration = 60;

import { withAuth } from "@/lib/http";
import { parseAttendanceBody } from "@/lib/contracts/attendance";
import { parseAttendance } from "@/server/attendance";

export const POST = withAuth(
  async ({ body }) => parseAttendance(body),
  { bodySchema: parseAttendanceBody }
);
