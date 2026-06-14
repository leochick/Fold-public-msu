import { withAuth } from "@/lib/http";
import { z } from "zod";
import { db } from "@/lib/db";
import { attendances } from "../../../../drizzle/schema";

// Type-safe Zod contract to enforce an array of event IDs
const batchLinkContract = z.object({
  studentId: z.number().int().positive(),
  eventIds: z.array(z.number().int().positive()).min(1),
});

export const POST = withAuth(
  async ({ user, body }) => {
    const { studentId, eventIds } = body;

    // Loop through all selected checkboxes and batch insert rows into Turso
    for (const eventId of eventIds) {
      try {
        await db.insert(attendances).values({
          studentId,
          eventId,
          recordedBy: user.id,
        });
      } catch (err) {
        // Safe catch: skips silently if the user is already checked into this event
      }
    }

    return { success: true };
  },
  { bodySchema: batchLinkContract }
);
