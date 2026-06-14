import { withAuth } from "@/lib/http";
import { linkStudentEventBody } from "@/lib/contracts/students";
import { db } from "@/lib/db";
import { attendances } from "../../../../drizzle/schema"

export const POST = withAuth(
  async ({ user, body }) => {
    try {
      await db.insert(attendances).values({
        studentId: body.studentId,
        eventId: body.eventId,
        recordedBy: user.id,
      });
      return { success: true };
    } catch (err) {
      // If they are already marked present, treat it as a silent success
      return { success: true, message: "Already linked" };
    }
  },
  { bodySchema: linkStudentEventBody }
);
