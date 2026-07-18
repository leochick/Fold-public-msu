import { describe, expect, it } from "vitest";
import {
  formatStaffActiveLabel,
  isStaffActiveInRange,
  partitionStaffByActiveInRange,
} from "../staff-active";

const from = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));
const to = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

describe("isStaffActiveInRange", () => {
  it("treats open-ended staff as active", () => {
    expect(isStaffActiveInRange({}, from, to)).toBe(true);
    expect(isStaffActiveInRange({ startingDate: null, endingDate: null }, from, to)).toBe(true);
  });

  it("returns true when staff interval overlaps the view", () => {
    expect(
      isStaffActiveInRange(
        {
          startingDate: new Date(Date.UTC(2025, 11, 15, 12)),
          endingDate: new Date(Date.UTC(2026, 0, 15, 12)),
        },
        from,
        to
      )
    ).toBe(true);
    expect(
      isStaffActiveInRange(
        { startingDate: new Date(Date.UTC(2026, 0, 31, 12)), endingDate: null },
        from,
        to
      )
    ).toBe(true);
  });

  it("returns false when staff ended before the view", () => {
    expect(
      isStaffActiveInRange(
        {
          startingDate: new Date(Date.UTC(2024, 0, 1, 12)),
          endingDate: new Date(Date.UTC(2025, 11, 31, 12)),
        },
        from,
        to
      )
    ).toBe(false);
  });

  it("returns false when staff starts after the view", () => {
    expect(
      isStaffActiveInRange(
        { startingDate: new Date(Date.UTC(2026, 1, 1, 12)), endingDate: null },
        from,
        to
      )
    ).toBe(false);
  });
});

describe("partitionStaffByActiveInRange", () => {
  it("splits active and inactive staff", () => {
    const rows = [
      { id: 1, endingDate: new Date(Date.UTC(2025, 5, 1, 12)) },
      { id: 2, startingDate: null, endingDate: null },
      { id: 3, startingDate: new Date(Date.UTC(2026, 5, 1, 12)) },
    ];
    expect(partitionStaffByActiveInRange(rows, from, to)).toEqual({
      active: [rows[1]],
      inactive: [rows[0], rows[2]],
    });
  });
});

describe("formatStaffActiveLabel", () => {
  it("appends active or inactive", () => {
    expect(formatStaffActiveLabel("Armel Mwanatambwe", {}, from, to)).toBe(
      "Armel Mwanatambwe (active)"
    );
    expect(
      formatStaffActiveLabel(
        "Jonathan Vasquez",
        { endingDate: new Date(Date.UTC(2025, 0, 1, 12)) },
        from,
        to
      )
    ).toBe("Jonathan Vasquez (inactive)");
  });
});
