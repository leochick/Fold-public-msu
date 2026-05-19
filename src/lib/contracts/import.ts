import { z } from "zod";
import { SCHEMA_FIELDS, type SchemaField } from "@/lib/csv";

const schemaField: z.ZodType<SchemaField> = z.custom((v) =>
  typeof v === "string" && (SCHEMA_FIELDS as readonly string[]).concat("skip").includes(v)
);

export const importBody = z.object({
  csv: z.string().min(1),
  mode: z.enum(["preview", "commit"]).default("preview"),
  mapping: z.array(schemaField).optional(),
});
