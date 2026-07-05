import { describe, expect, it } from "vitest";
import {
  describeFieldChanges,
  formatChangelogSummaryForDisplay,
  formatEventLabel,
  formatStudentLabel,
  listFieldChanges,
} from "../changelog";

describe("changelog formatting", () => {
  it("formats student and event labels", () => {
    expect(formatStudentLabel({ firstName: "Amar", lastName: "Jain" })).toBe("Amar Jain");
    expect(formatEventLabel({ name: "Weekly", startDate: new Date("2026-01-15T00:00:00Z") })).toBe(
      "Weekly (1/15/2026)"
    );
  });

  it("describes field changes", () => {
    const summary = describeFieldChanges(
      { newsletter: false, groupme: false },
      { newsletter: true, groupme: true },
      ["newsletter", "groupme"],
      { newsletter: "Newsletter", groupme: "Groupme" }
    );
    expect(summary).toBe("Newsletter: no → yes\nGroupme: no → yes");
  });

  it("skips no-op display values", () => {
    expect(
      listFieldChanges(
        { courseMaterial: null },
        { courseMaterial: [] },
        ["courseMaterial"],
        { courseMaterial: "Course material" }
      )
    ).toEqual([]);
  });

  it("normalizes legacy update summaries for display", () => {
    expect(
      formatChangelogSummaryForDisplay(
        "Updated Domanic Quenby-Denda: First name: Dominic → Domanic; Course material: — → —",
        "update"
      )
    ).toBe("First name: Dominic → Domanic");
  });
});
