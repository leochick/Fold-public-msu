import { z } from "zod";
import { genderSchema, yearSchema, memberStatusSchema, positiveInt, nonEmptyText } from "./shared";

export const parseAttendanceBody = z.object({
  eventId: positiveInt,
  text: nonEmptyText,
});
export type ParseAttendanceBody = z.infer<typeof parseAttendanceBody>;

export const attendeeSchema = z.object({
  match: z.enum(["existing", "new"]),
  studentId: z.number().int().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: genderSchema.optional(),
  year: yearSchema.optional(),
  igHandle: z.string().optional(),
  memberStatus: memberStatusSchema.optional(),
  invitedById: z.number().int().optional(),
  notes: z.string().optional(),
  rawText: z.string().optional(),
});
export type Attendee = z.infer<typeof attendeeSchema>;

export const commitAttendanceBody = z.object({
  eventId: positiveInt,
  attendees: z.array(attendeeSchema).default([]),
});
export type CommitAttendanceBody = z.infer<typeof commitAttendanceBody>;
