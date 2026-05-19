import { test, expect } from "vitest";
import {
  placeRiders,
  validateAssignment,
  type SolverRider,
  type SolverVehicle,
} from "../solver";

const r = (id: string, gender?: "M" | "F", studentId?: number, year?: string): SolverRider => ({
  riderId: id,
  displayName: id,
  studentId,
  gender,
  year,
});

const v = (
  id: number,
  capacity: number,
  driverGender?: "M" | "F",
  driverStudentId?: number
): SolverVehicle => ({
  vehicleId: id,
  name: `Car${id}`,
  capacity,
  driverName: `Driver${id}`,
  driverGender,
  driverStudentId,
});

test("capacity overflow → riders unassigned", () => {
  const riders = [r("a", "M", 1), r("b", "M", 2), r("c", "M", 3)];
  const vehicles = [v(1, 2)];
  const out = placeRiders(riders, vehicles, {}, false);
  expect(out.assignments[0].riderIds).toHaveLength(1);
  expect(out.unassigned).toHaveLength(2);
  expect(out.unsatisfiable).toHaveLength(1);
  expect(out.unsatisfiable[0].kind).toBe("seats_short");
});

test("gender rule: 1M + 2F across 2 cars — solver puts both Fs together", () => {
  const riders = [r("m1", "M", 1), r("f1", "F", 2), r("f2", "F", 3)];
  const vehicles = [v(1, 4), v(2, 4)];
  const out = placeRiders(riders, vehicles, {}, true);
  expect(out.unassigned).toHaveLength(0);
  expect(out.violations).toHaveLength(0);
  const mCar = out.assignments.find((a) => a.riderIds.includes("m1"))!;
  const fCar = out.assignments.find((a) => a.vehicleId !== mCar.vehicleId)!;
  expect(mCar.riderIds.some((id) => id.startsWith("f"))).toBe(false);
  expect(fCar.riderIds).toHaveLength(2);
});

test("gender rule OFF: any composition allowed", () => {
  const riders = [r("m1", "M", 1), r("f1", "F", 2)];
  const vehicles = [v(1, 4)];
  const out = placeRiders(riders, vehicles, {}, false);
  expect(out.violations).toHaveLength(0);
  expect(out.unassigned).toHaveLength(0);
});

test("rule symmetric: 1F with ≥1M flagged", () => {
  const riders = [r("m1", "M", 1), r("m2", "M", 2), r("f1", "F", 3)];
  const vehicles = [v(1, 4)];
  const out = placeRiders(riders, vehicles, {}, true);
  expect(out.unassigned).toContain("f1");
});

test("driver gender counts: lone M driver + 1F passenger = violation", () => {
  const riders = [r("f1", "F", 1)];
  const vehicles = [v(1, 4, "M")];
  const out = placeRiders(riders, vehicles, {}, true);
  expect(out.unassigned).toContain("f1");
});

test("driver gender unknown → warning, not violation", () => {
  const riders = [r("f1", "F", 1), r("f2", "F", 2)];
  const vehicles = [v(1, 4)];
  const out = placeRiders(riders, vehicles, {}, true);
  expect(out.violations).toHaveLength(0);
  expect(out.warnings.length).toBeGreaterThanOrEqual(1);
});

test("groupTogether honored when feasible", () => {
  const riders = [r("a", "M", 1), r("b", "M", 2), r("c", "F", 3), r("d", "F", 4)];
  const vehicles = [v(1, 4), v(2, 4)];
  const out = placeRiders(riders, vehicles, { groupTogether: [[1, 2]] }, true);
  const aCar = out.assignments.find((x) => x.riderIds.includes("a"))!;
  expect(aCar.riderIds).toContain("b");
});

test("pinned: places rider on specified vehicle", () => {
  const riders = [r("a", "M", 1), r("b", "M", 2)];
  const vehicles = [v(1, 4), v(2, 4)];
  const out = placeRiders(riders, vehicles, { pinned: [{ studentId: 2, vehicleId: 1 }] }, false);
  const car1 = out.assignments.find((x) => x.vehicleId === 1)!;
  expect(car1.riderIds).toContain("b");
});

test("pin to full vehicle reports unsatisfiable", () => {
  const riders = [r("a", "M", 1), r("b", "M", 2), r("c", "M", 3), r("d", "M", 4)];
  const vehicles = [v(1, 2)];
  const out = placeRiders(
    riders,
    vehicles,
    { pinned: [{ studentId: 1, vehicleId: 1 }, { studentId: 2, vehicleId: 1 }] },
    false
  );
  expect(out.unsatisfiable.some((u) => u.kind === "pin_conflict")).toBe(true);
});

test("driver-as-student excluded from rider pool", () => {
  const riders = [r("driver", "M", 99), r("a", "M", 1)];
  const vehicles = [v(1, 4, "M", 99)];
  const out = placeRiders(riders, vehicles, {}, false);
  const car = out.assignments[0];
  expect(car.riderIds).not.toContain("driver");
  expect(car.riderIds).toContain("a");
  expect(out.unassigned).not.toContain("driver");
});

test("validateAssignment flags capacity overflow", () => {
  const riders = [r("a", "M"), r("b", "F"), r("c", "M"), r("d", "F")];
  const vehicles = [v(1, 3)];
  const assignments = [{ vehicleId: 1, riderIds: ["a", "b", "c", "d"] }];
  const out = validateAssignment(riders, vehicles, assignments, true);
  expect(out.violations.some((vio) => vio.kind === "capacity")).toBe(true);
});

test("validateAssignment flags hard gender violation", () => {
  const riders = [r("m1", "M"), r("f1", "F"), r("f2", "F")];
  const vehicles = [v(1, 6)];
  const assignments = [{ vehicleId: 1, riderIds: ["m1", "f1", "f2"] }];
  const out = validateAssignment(riders, vehicles, assignments, true);
  expect(out.violations.some((vio) => vio.kind === "genderRule")).toBe(true);
});

test("validateAssignment passes for 2M+2F", () => {
  const riders = [r("m1", "M"), r("m2", "M"), r("f1", "F"), r("f2", "F")];
  const vehicles = [v(1, 6)];
  const assignments = [{ vehicleId: 1, riderIds: ["m1", "m2", "f1", "f2"] }];
  const out = validateAssignment(riders, vehicles, assignments, true);
  expect(out.violations).toHaveLength(0);
});

test("balance flag: spreads same-year riders across cars", () => {
  const riders = [
    r("a", "M", 1, "freshman"),
    r("b", "M", 2, "freshman"),
    r("c", "M", 3, "freshman"),
    r("d", "M", 4, "freshman"),
  ];
  const vehicles = [v(1, 4), v(2, 4)];
  const out = placeRiders(riders, vehicles, { balance: true }, false);
  const counts = out.assignments.map((a) => a.riderIds.length).sort();
  expect(counts).toEqual([2, 2]);
});
