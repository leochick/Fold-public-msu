import { withAuth } from "@/lib/http";
import { z } from "zod";
import { db } from "@/lib/db";
import { students, attendances } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { pickStudentFields } from "@/lib/changelog";
import { logStudentCreated, logStudentUpdated } from "@/server/changelog";

const commitAttendeesSchema = z.object({
  eventId: z.number().int().positive(),
  items: z.array(
    z.object({
      action: z.enum(["create", "merge", "skip"]),
      incoming: z.object({
        firstName: z.string(),
        lastName: z.string().nullable().optional(),
        gender: z.enum(["M", "F"]).nullable().optional(),
        year: z.enum(["freshman", "sophomore", "junior", "senior", "grad", "other"]).nullable().optional(),
        phone: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        igHandle: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      selectedExistingId: z.number().int().optional(),
    })
  ),
});

export const POST = withAuth(
  async ({ user, body }) => {
    const { eventId, items } = body;
    let checkedInCount = 0;

    for (const item of items) {
      let finalStudentId: number | null = null;

      if (item.action === "skip") continue;

      if (item.action === "create") {
        const [newStudent] = await db.insert(students).values({
          firstName: item.incoming.firstName,
          lastName: item.incoming.lastName ?? null,
          gender: (item.incoming.gender as any) ?? null,
          year: (item.incoming.year as any) ?? null,
          phone: item.incoming.phone ?? null,
          email: item.incoming.email ?? null,
          igHandle: item.incoming.igHandle ?? null,
          notes: item.incoming.notes ?? null,
          addedByUserId: user.id,
          funnelStage: "new",
        }).returning();
        
        finalStudentId = newStudent.id;
        await logStudentCreated(user.id, newStudent, "Event batch check-in");
      } else if (item.action === "merge" && item.selectedExistingId) {
        finalStudentId = item.selectedExistingId;
        const [old] = await db.select().from(students).where(eq(students.id, finalStudentId)).limit(1);
        
        if (old) {
          const before = pickStudentFields(old as Record<string, unknown>);
          const patch = {
              lastName: item.incoming.lastName || old.lastName,
              gender: (item.incoming.gender as any) || old.gender,
              year: (item.incoming.year as any) || old.year,
              phone: item.incoming.phone || old.phone,
              email: item.incoming.email || old.email,
              igHandle: item.incoming.igHandle || old.igHandle,
              notes: item.incoming.notes 
                ? `${old.notes ?? ""}\n[Event Ingest Merge]: ${item.incoming.notes}`.trim()
                : old.notes,
              updatedAt: new Date(),
            };
          await db
            .update(students)
            .set(patch)
            .where(eq(students.id, finalStudentId));
          await logStudentUpdated(
            user.id,
            finalStudentId,
            before,
            { ...before, ...patch }
          );
        }
      }

      // Log the student into the attendance table for this event
      if (finalStudentId) {
        try {
          await db.insert(attendances).values({
            studentId: finalStudentId,
            eventId,
            recordedBy: user.id,
          });
          checkedInCount++;
        } catch (e) {
          // Gracefully handles the entry if they are already checked into the event
        }
      }
    }

    return { success: true, checkedIn: checkedInCount };
  },
  { bodySchema: commitAttendeesSchema }
);
