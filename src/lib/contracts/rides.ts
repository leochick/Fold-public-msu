import { z } from "zod";
import { genderSchema, nonEmptyText } from "./shared";

const vehicleInPlay = z.object({
  vehicleId: z.number().int(),
  name: z.string(),
  capacity: z.number().int().positive(),
  driverName: z.string(),
  driverGender: genderSchema.optional(),
  driverStudentId: z.number().int().optional(),
});

const parsedRider = z.object({
  match: z.enum(["existing", "new"]),
  studentId: z.number().int().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: genderSchema.optional(),
  year: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  rawText: z.string(),
  riderId: z.string(),
  displayName: z.string(),
});

const previewAssignment = z.object({
  vehicleId: z.number().int(),
  riderIds: z.array(z.string()),
});

export const ridesParseBody = z.object({
  sessionId: z.number().int().positive(),
  text: nonEmptyText,
  vehicles: z.array(vehicleInPlay).min(1),
  enforceGenderRule: z.boolean().optional(),
});

export const ridesFleetBody = z.object({ text: nonEmptyText });

export const ridesValidateBody = z.object({
  riders: z.array(parsedRider).default([]),
  vehicles: z.array(vehicleInPlay).default([]),
  assignments: z.array(previewAssignment).default([]),
  enforceGenderRule: z.boolean().optional(),
});

export const ridesCommitBody = z.object({
  sessionId: z.number().int().positive(),
  enforceGenderRule: z.boolean().optional(),
  vehicles: z.array(vehicleInPlay).default([]),
  riders: z.array(parsedRider).default([]),
  assignments: z.array(previewAssignment).default([]),
});
