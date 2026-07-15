import { z } from "zod";

export const staffAllocationInsightsBody = z.object({
  viewName: z.string().min(1),
  viewFrom: z.string().min(1),
  viewTo: z.string().min(1),
  staff: z
    .array(
      z.object({
        id: z.number().int(),
        firstName: z.string(),
        lastName: z.string().nullable(),
        gender: z.enum(["M", "F"]).nullable(),
        roles: z.array(z.object({ roleName: z.string() })),
        groupings: z.array(
          z.object({
            groupingId: z.number().int(),
            groupingName: z.string(),
            containerTitle: z.string(),
            containerIndex: z.number().int(),
            students: z.array(
              z.object({
                id: z.number().int(),
                firstName: z.string(),
                lastName: z.string().nullable(),
              })
            ),
          })
        ),
      })
    )
    .default([]),
});

export type StaffAllocationInsightsBody = z.infer<typeof staffAllocationInsightsBody>;
