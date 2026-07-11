import { z } from "zod";
import { genderSchema, nonEmptyText } from "./shared";

export const intakeParseBody = z.object({ text: nonEmptyText });
export type IntakeParseBody = z.infer<typeof intakeParseBody>;

const parsedContactSchema = z.object({
  match: z.enum(["existing", "new"]),
  studentId: z.number().int().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: genderSchema.optional(),
  year: z.string().optional(),
  igHandle: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  firstMetContext: z.string().optional(),
  notes: z.string().optional(),
  rawText: z.string(),
  contactId: z.string(),
  existingDisplayName: z.string().optional(),
  serverDedupCandidates: z.array(z.unknown()).default([]),
});

export const intakeCommitBody = z.object({
  contacts: z.array(parsedContactSchema).default([]),
});
