import { z } from "zod";
import {
  channelSchema,
  funnelStageSchema,
  genderSchema,
  memberStatusSchema,
  nonEmptyText,
  yearSchema,
} from "./shared";

export const parseUpdateBody = z.object({ text: nonEmptyText });
export type ParseUpdateBody = z.infer<typeof parseUpdateBody>;

const patchSchema = z
  .object({
    firstName: z.string(),
    lastName: z.string(),
    gender: genderSchema,
    year: yearSchema,
    phone: z.string(),
    email: z.string(),
    igHandle: z.string(),
    memberStatus: memberStatusSchema,
    isActive: z.boolean(),
    contactedViaIg: z.boolean(),
    primaryContact: z.string(),
    goals: z.string(),
    notes: z.string(),
    notesAppend: z.string(),
  })
  .partial();

export const commitUpdatesBody = z.object({
  updates: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        patch: patchSchema.default({}),
        notesAppend: z.string().optional(),
      })
    )
    .default([]),
  creates: z
    .array(
      z
        .object({
          firstName: z.string().min(1),
          lastName: z.string(),
          gender: genderSchema,
          year: yearSchema,
          phone: z.string(),
          email: z.string(),
          igHandle: z.string(),
          memberStatus: memberStatusSchema,
          primaryContact: z.string(),
          notes: z.string(),
        })
        .partial({
          lastName: true,
          gender: true,
          year: true,
          phone: true,
          email: true,
          igHandle: true,
          memberStatus: true,
          primaryContact: true,
          notes: true,
        })
    )
    .default([]),
  deletes: z
    .array(z.object({ studentId: z.number().int().positive() }))
    .default([]),
});

export const funnelStageBody = z.object({ stage: funnelStageSchema });

export const draftOutreachBody = z.object({
  channel: channelSchema.default("ig_dm"),
  purpose: z.string().optional(),
  refinement: z.string().optional(),
});
export type DraftOutreachBody = z.infer<typeof draftOutreachBody>;

export const contactLogBody = z.object({
  studentId: z.number().int().positive(),
  channel: channelSchema,
  channelDetail: z.string().optional(),
  responded: z.boolean().optional(),
  notes: z.string().optional(),
});
