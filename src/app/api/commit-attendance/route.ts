import { withAuth } from "@/lib/http";
import { commitAttendanceBody } from "@/lib/contracts/attendance";
import { commitAttendance } from "@/server/attendance";

export const POST = withAuth(
  async ({ user, body }) => commitAttendance(user.id, body),
  { bodySchema: commitAttendanceBody }
);
