import { z } from "zod";

export const genderSchema = z.enum(["M", "F"]);
export const yearSchema = z.enum(["freshman", "sophomore", "junior", "senior", "grad", "other"]);
export const memberStatusSchema = z.enum(["prospect", "member", "core"]);
export const channelSchema = z.enum(["ig_dm", "text", "phone", "email", "in_person", "other"]);
export const funnelStageSchema = z.enum([
  "new",
  "reaching_out",
  "connected",
  "met",
  "active",
  "engaged",
  "inactive",
]);

export const nonEmptyText = z.string().min(1).max(20_000);
export const positiveInt = z.number().int().positive();
