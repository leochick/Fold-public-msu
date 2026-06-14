import { db } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import {
  students,
  rideSessions,
  rides as ridesTable,
  rideAssignments,
  vehicles as vehiclesTable,
} from "../../drizzle/schema";
import { anthropic, MODEL } from "@/lib/claude";
import { PROPOSE_RIDE_PLAN_TOOL, PROPOSE_FLEET_TOOL } from "@/lib/rides/claude-tools";
import { placeRiders, validateAssignment, type SolverRider, type SolverVehicle } from "@/lib/rides/solver";
import { RIDES_PARSE_SYSTEM, buildRidesParseUserMsg } from "@/lib/prompts/rides-parse";
import { RIDES_FLEET_SYSTEM, buildRidesFleetUserMsg } from "@/lib/prompts/rides-parse-fleet";
import { httpErr } from "@/lib/http";
import { callClaudeOrThrow } from "./attendance";
import type {
  FleetParsePreview,
  Gender,
  ParsedDirectives,
  ParsedRider,
  ParsePreview,
  PreviewAssignment,
  VehicleInPlay,
} from "@/lib/rides/shared";

interface RidesParseToolInput {
  riders?: Array<{
    match: "existing" | "new";
    studentId?: number;
    firstName?: string;
    lastName?: string;
    gender?: Gender;
    year?: string;
    phone?: string;
    notes?: string;
    rawText: string;
  }>;
  directives?: ParsedDirectives;
  ambiguous?: string[];
  explanation?: string;
}

interface RidesFleetToolInput {
  vehicles?: Array<{
    match: "saved" | "ad_hoc";
    savedVehicleId?: number;
    name: string;
    capacity: number;
    driverName: string;
    driverStudentId?: number;
    driverGender?: Gender;
    rawText: string;
  }>;
  ambiguousVehicleNames?: string[];
  explanation?: string;
}

export async function parseRides(input: {
  sessionId: number;
  text: string;
  vehicles: VehicleInPlay[];
  enforceGenderRule: boolean;
}): Promise<ParsePreview> {
  const [session] = await db
    .select()
    .from(rideSessions)
    .where(eq(rideSessions.id, input.sessionId))
    .limit(1);
  if (!session) throw httpErr.notFound("session not found");

  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
      year: students.year,
    })
    .from(students);

  const rosterCompact = roster
    .map((r) => {
      const tags: string[] = [];
      if (r.gender) tags.push(r.gender);
      if (r.year) tags.push(r.year);
      const tail = tags.length ? ` [${tags.join(",")}]` : "";
      return `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${tail}`;
    })
    .join("\n");
  const vehiclesCompact = input.vehicles
    .map((v) => {
      const dg = v.driverGender ? ` (${v.driverGender})` : "";
      return `${v.vehicleId}|${v.name}, capacity ${v.capacity}, driver ${v.driverName}${dg}`;
    })
    .join("\n");

  const userMsg = buildRidesParseUserMsg(rosterCompact, vehiclesCompact, input.enforceGenderRule, input.text);

  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: RIDES_PARSE_SYSTEM,
      tools: [PROPOSE_RIDE_PLAN_TOOL],
      tool_choice: { type: "tool", name: PROPOSE_RIDE_PLAN_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");

  const out = toolUse.input as RidesParseToolInput;
  const rosterById = new Map(roster.map((r) => [r.id, r]));

  const parsedRiders: ParsedRider[] = (out.riders ?? []).map((r, i) => {
    if (r.match === "existing" && typeof r.studentId === "number" && rosterById.has(r.studentId)) {
      const s = rosterById.get(r.studentId)!;
      return {
        ...r,
        riderId: `s:${s.id}`,
        displayName: `${s.firstName}${s.lastName ? " " + s.lastName : ""}`,
        gender: s.gender ?? undefined,
        year: s.year ?? undefined,
      };
    }
    const display =
      [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || r.rawText.trim();
    return {
      ...r,
      match: "new",
      riderId: `n:${i}`,
      displayName: display,
    };
  });

  const seen = new Set<string>();
  const dedupedRiders = parsedRiders.filter((r) => {
    if (seen.has(r.riderId)) return false;
    seen.add(r.riderId);
    return true;
  });

  const directives: ParsedDirectives = out.directives ?? {};
  const finalEnforce = input.enforceGenderRule ||
    (out.directives as Record<string, unknown>)?.enforceGenderRule === true;

  const solverRiders: SolverRider[] = dedupedRiders.map((r) => ({
    riderId: r.riderId,
    displayName: r.displayName,
    studentId: r.match === "existing" ? r.studentId : undefined,
    gender: r.gender,
    year: r.year,
  }));
  const solverVehicles: SolverVehicle[] = input.vehicles.map((v) => ({
    vehicleId: v.vehicleId,
    name: v.name,
    capacity: v.capacity,
    driverName: v.driverName,
    driverGender: v.driverGender,
    driverStudentId: v.driverStudentId,
  }));
  const solved = placeRiders(solverRiders, solverVehicles, directives, finalEnforce);

  return {
    riders: dedupedRiders,
    directives,
    ambiguous: out.ambiguous ?? [],
    explanation: out.explanation ?? `Parsed ${dedupedRiders.length} rider(s).`,
    vehicles: input.vehicles,
    enforceGenderRule: finalEnforce,
    assignments: solved.assignments,
    unassigned: solved.unassigned,
    violations: solved.violations,
    warnings: solved.warnings,
    unsatisfiable: solved.unsatisfiable,
  };
}

export async function parseFleet(text: string): Promise<FleetParsePreview> {
  const fleet = await db.select().from(vehiclesTable).orderBy(asc(vehiclesTable.name));
  const activeFleet = fleet.filter((v) => v.isActive);
  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
    })
    .from(students);

  const fleetCompact = activeFleet
    .map((v) => `${v.id}|${v.name}, capacity ${v.capacity}`)
    .join("\n");
  const rosterCompact = roster
    .map((r) => {
      const g = r.gender ? ` [${r.gender}]` : "";
      return `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${g}`;
    })
    .join("\n");

  const userMsg = buildRidesFleetUserMsg(fleetCompact, rosterCompact, text);
  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: RIDES_FLEET_SYSTEM,
      tools: [PROPOSE_FLEET_TOOL],
      tool_choice: { type: "tool", name: PROPOSE_FLEET_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");

  const out = toolUse.input as RidesFleetToolInput;
  const fleetById = new Map(fleet.map((v) => [v.id, v]));
  const rosterById = new Map(roster.map((r) => [r.id, r]));
  const seenIds = new Set<number>();
  const vehicles: VehicleInPlay[] = [];
  let adHocCounter = 0;

  for (const v of out.vehicles ?? []) {
    let vehicleId: number;
    let name = v.name;
    let capacity = v.capacity;

    if (v.match === "saved" && typeof v.savedVehicleId === "number" && fleetById.has(v.savedVehicleId)) {
      if (seenIds.has(v.savedVehicleId)) continue;
      seenIds.add(v.savedVehicleId);
      const sv = fleetById.get(v.savedVehicleId)!;
      vehicleId = sv.id;
      name = sv.name;
      if (!Number.isFinite(capacity) || capacity <= 0) capacity = sv.capacity;
    } else {
      adHocCounter += 1;
      vehicleId = -((Date.now() % 1_000_000) + adHocCounter);
      if (!Number.isFinite(capacity) || capacity <= 0) capacity = 5;
    }

    let driverGender = v.driverGender;
    let driverStudentId = v.driverStudentId;
    if (typeof driverStudentId === "number" && rosterById.has(driverStudentId)) {
      const s = rosterById.get(driverStudentId)!;
      if (!driverGender && s.gender) driverGender = s.gender;
    } else {
      driverStudentId = undefined;
    }

    vehicles.push({
      vehicleId,
      name,
      capacity: Math.max(2, Math.min(20, Math.round(capacity))),
      driverName: v.driverName.trim(),
      driverGender,
      driverStudentId,
    });
  }

  return {
    vehicles,
    ambiguousVehicleNames: out.ambiguousVehicleNames ?? [],
    explanation: out.explanation ?? `Parsed ${vehicles.length} vehicle(s).`,
  };
}

export function validateRides(input: {
  riders: ParsedRider[];
  vehicles: VehicleInPlay[];
  assignments: PreviewAssignment[];
  enforceGenderRule: boolean;
}) {
  const solverRiders: SolverRider[] = input.riders.map((r) => ({
    riderId: r.riderId,
    displayName: r.displayName,
    studentId: r.match === "existing" ? r.studentId : undefined,
    gender: r.gender,
    year: r.year,
  }));
  const solverVehicles: SolverVehicle[] = input.vehicles.map((v) => ({
    vehicleId: v.vehicleId,
    name: v.name,
    capacity: v.capacity,
    driverName: v.driverName,
    driverGender: v.driverGender,
    driverStudentId: v.driverStudentId,
  }));
  return validateAssignment(solverRiders, solverVehicles, input.assignments, input.enforceGenderRule);
}

export async function commitRides(
  userId: string,
  input: {
    sessionId: number;
    enforceGenderRule: boolean;
    vehicles: VehicleInPlay[];
    riders: ParsedRider[];
    assignments: PreviewAssignment[];
  }
) {
  const [session] = await db
    .select()
    .from(rideSessions)
    .where(eq(rideSessions.id, input.sessionId))
    .limit(1);
  if (!session) throw httpErr.notFound("session not found");

  const riderIdToStudentId = new Map<string, number>();
  let createdCount = 0;
  for (const r of input.riders) {
    if (r.match === "existing" && typeof r.studentId === "number") {
      riderIdToStudentId.set(r.riderId, r.studentId);
      continue;
    }
    if (r.match === "new" && r.firstName) {
      const [row] = await db
        .insert(students)
        .values({
          firstName: r.firstName,
          lastName: r.lastName ?? null,
          gender: r.gender ?? null,
          year: (r.year as never) ?? null,
          phone: r.phone ?? null,
          notes: r.notes ?? null,
          addedByUserId: userId,
        })
        .returning();
      riderIdToStudentId.set(r.riderId, row.id);
      createdCount++;
    }
  }

  const vehicleIds = input.vehicles.map((v) => v.vehicleId).filter((id) => id > 0);
  const vehicleById = new Map<number, typeof vehiclesTable.$inferSelect>();
  for (const id of vehicleIds) {
    if (vehicleById.has(id)) continue;
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (v) vehicleById.set(v.id, v);
  }

  await db
    .update(rideSessions)
    .set({ enforceGenderRule: input.enforceGenderRule, recordedBy: userId })
    .where(eq(rideSessions.id, input.sessionId));

  await db.delete(rideAssignments).where(eq(rideAssignments.rideSessionId, input.sessionId));
  await db.delete(ridesTable).where(eq(ridesTable.rideSessionId, input.sessionId));

  let assignedCount = 0;
  for (const a of input.assignments) {
    const inPlay = input.vehicles.find((v) => v.vehicleId === a.vehicleId);
    if (!inPlay) continue;
    const live = vehicleById.get(a.vehicleId);
    const [rideRow] = await db
      .insert(ridesTable)
      .values({
        rideSessionId: input.sessionId,
        vehicleId: live ? live.id : null,
        vehicleNameSnapshot: inPlay.name,
        capacitySnapshot: inPlay.capacity,
        driverName: inPlay.driverName,
        driverStudentId: inPlay.driverStudentId ?? null,
        driverGender: inPlay.driverGender ?? null,
      })
      .returning();
    for (const rid of a.riderIds) {
      const sid = riderIdToStudentId.get(rid);
      if (!sid) continue;
      try {
        await db.insert(rideAssignments).values({
          rideId: rideRow.id,
          rideSessionId: input.sessionId,
          studentId: sid,
        });
        assignedCount++;
      } catch {
        /* unique constraint */
      }
    }
  }
  return { ok: true, created: createdCount, assigned: assignedCount };
}
