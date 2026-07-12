import { z } from "zod";
import { attendeeSchema } from "./attendance";
import { nonEmptyText } from "./shared";

export const parseEventBatchBody = z.object({ text: nonEmptyText });
export type ParseEventBatchBody = z.infer<typeof parseEventBatchBody>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const eventInputSchema = z.object({
  name: z.string().min(1),
  /** Required when creating; optional for notes-only / title-matched updates. */
  date: isoDate.optional(),
  type: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  totalStudents: z.number().int().optional(),
});

export const batchEventIncomingSchema = eventInputSchema;
export type BatchEventIncoming = z.infer<typeof batchEventIncomingSchema>;

export const batchEventConfirmEntrySchema = z.object({
  action: z.enum(["create", "merge", "skip"]),
  incoming: batchEventIncomingSchema,
  existingId: z.number().int().optional(),
});

export const commitEventBatchBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    eventAction: z.enum(["create", "merge", "skip"]).default("create"),
    event: eventInputSchema.extend({ isNew: z.boolean().optional() }),
    existingEventId: z.number().int().optional(),
    attendees: z.array(attendeeSchema).default([]),
  }),
  z.object({
    mode: z.literal("batch"),
    items: z.array(batchEventConfirmEntrySchema).min(1),
  }),
]);
export type CommitEventBatchBody = z.infer<typeof commitEventBatchBody>;

export const eventInsightsBody = z.object({
  aggregates: z.object({ totalEvents: z.number() }).passthrough(),
});

export const eventInsightsSingleBody = z.object({
  eventId: z.number().int().positive(),
  stats: z
    .object({
      total: z.number(),
      firstTimers: z.number(),
      returners: z.number(),
      genderSplit: z.object({ M: z.number(), F: z.number(), unknown: z.number() }),
      inviteChains: z.array(z.object({ inviter: z.string(), invitees: z.array(z.string()) })),
    })
    .passthrough(),
});
