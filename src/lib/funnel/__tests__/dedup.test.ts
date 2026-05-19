import { test, expect } from "vitest";
import {
  findPossibleDuplicates,
  levenshtein,
  normalizeEmail,
  normalizeIg,
  phoneLast7,
  type RosterRow,
} from "../dedup";

const NOW = new Date("2026-09-10T12:00:00Z");

const r = (
  id: number,
  firstName: string,
  lastName?: string,
  extras: Partial<Pick<RosterRow, "igHandle" | "phone" | "email" | "createdAt">> = {}
): RosterRow => ({
  id,
  firstName,
  lastName: lastName ?? null,
  igHandle: extras.igHandle ?? null,
  phone: extras.phone ?? null,
  email: extras.email ?? null,
  createdAt: extras.createdAt ?? new Date("2025-01-01T00:00:00Z"),
});

test("normalizers", () => {
  expect(normalizeIg("@JordanChen")).toBe("jordanchen");
  expect(normalizeIg("jordanchen")).toBe("jordanchen");
  expect(normalizeIg(null)).toBe("");
  expect(phoneLast7("(650) 555-1234")).toBe("5551234");
  expect(phoneLast7("+1 650 555-1234")).toBe("5551234");
  expect(phoneLast7("123")).toBe("");
  expect(normalizeEmail("Jordan.Chen+gym@gmail.com")).toBe("jordanchen@gmail.com");
  expect(normalizeEmail("Jordan.Chen@hotmail.com")).toBe("jordan.chen@hotmail.com");
});

test("levenshtein basics", () => {
  expect(levenshtein("jordan", "jordan")).toBe(0);
  expect(levenshtein("jordan chen", "jordan chen")).toBe(0);
  expect(levenshtein("jordan chen", "jordan cher")).toBe(1);
  expect(levenshtein("jordan chen", "jordaniel chen")).toBe(3);
  expect(levenshtein("sam", "sim")).toBe(1);
});

test("name fuzzy: catches close names within distance 2", () => {
  const out = findPossibleDuplicates(
    { firstName: "Jordan", lastName: "Chen" },
    [r(1, "Jordon", "Chen")],
    NOW
  );
  expect(out).toHaveLength(1);
  expect(out[0].reasons).toContain("name_fuzzy");
});

test("Alex vs Alexander NOT caught by name_fuzzy alone; caught via IG", () => {
  const noIg = findPossibleDuplicates(
    { firstName: "Alexander", lastName: "Rivera" },
    [r(1, "Alex", "Rivera")],
    NOW
  );
  expect(noIg).toHaveLength(0);

  const withIg = findPossibleDuplicates(
    { firstName: "Alexander", lastName: "Rivera", igHandle: "@AlexRivera99" },
    [r(1, "Alex", "Rivera", { igHandle: "alexrivera99" })],
    NOW
  );
  expect(withIg).toHaveLength(1);
  expect(withIg[0].reasons).toContain("ig_exact");
  expect(withIg[0].score).toBeGreaterThanOrEqual(90);
});

test("IG handle case insensitivity, with and without @", () => {
  const out = findPossibleDuplicates(
    { firstName: "Jordan", igHandle: "@JordanChen" },
    [r(1, "Whoever", undefined, { igHandle: "jordanchen" })],
    NOW
  );
  expect(out).toHaveLength(1);
  expect(out[0].reasons).toContain("ig_exact");
});

test("Phone last-7 across formats", () => {
  const out = findPossibleDuplicates(
    { firstName: "Jordan", phone: "(650) 555-1234" },
    [r(1, "J", undefined, { phone: "+16505551234" })],
    NOW
  );
  expect(out).toHaveLength(1);
  expect(out[0].reasons).toContain("phone_last7");
});

test("Email normalization: gmail dotless and +tag", () => {
  const out = findPossibleDuplicates(
    { firstName: "Jordan", email: "Jordan.Chen+gym@gmail.com" },
    [r(1, "Jordan", undefined, { email: "jordanchen@gmail.com" })],
    NOW
  );
  expect(out).toHaveLength(1);
  expect(out[0].reasons).toContain("email_normalized");
  expect(out[0].score).toBeGreaterThanOrEqual(95);
});

test("Recent-add bonus boosts score by 20 when candidate < 24h old", () => {
  const recent = new Date(NOW.getTime() - 30 * 60 * 1000);
  const out = findPossibleDuplicates(
    { firstName: "Alexander", lastName: "Rivera", igHandle: "@alexrivera99" },
    [r(1, "Alex", "Rivera", { igHandle: "alexrivera99", createdAt: recent })],
    NOW
  );
  expect(out).toHaveLength(1);
  expect(out[0].reasons).toContain("recent_add");
  expect(out[0].score).toBeGreaterThanOrEqual(110);
});

test("Below threshold not returned", () => {
  const out = findPossibleDuplicates(
    { firstName: "Alex", lastName: "Wong" },
    [r(1, "Jordan", "Chen"), r(2, "Sam", "Taylor")],
    NOW
  );
  expect(out).toHaveLength(0);
});

test("'Sam Taylor' vs 'Mary Taylor' NOT flagged (first-name dist > 2)", () => {
  const out = findPossibleDuplicates(
    { firstName: "Sam", lastName: "Taylor" },
    [r(1, "Mary", "Taylor")],
    NOW
  );
  expect(out).toHaveLength(0);
});

test("Multiple candidates returned, sorted desc by score", () => {
  const out = findPossibleDuplicates(
    { firstName: "Jordan", lastName: "Chen", igHandle: "jordanchen99" },
    [
      r(1, "Jordan", "Chen", { igHandle: "jordanchen99" }),
      r(2, "Jordan", "Chen"),
      r(3, "Alex", "Wong"),
    ],
    NOW
  );
  expect(out).toHaveLength(2);
  expect(out[0].studentId).toBe(1);
  expect(out[0].score).toBeGreaterThan(out[1].score);
});
