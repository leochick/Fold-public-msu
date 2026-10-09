import { describe, expect, it } from "vitest";
import {
  fallFootballSeasonYear,
  filterGamesToFallSeason,
  normalizeFootballGames,
  parseKickoffTime,
} from "@/lib/football-schedule";
import { buildFootballScheduleUserPrompt } from "@/lib/prompts/football-schedule";

describe("fallFootballSeasonYear", () => {
  it("uses the first year of an academic year label", () => {
    expect(fallFootballSeasonYear("2025-26")).toBe(2025);
    expect(fallFootballSeasonYear(" 2026-27 ")).toBe(2026);
  });

  it("returns null for other labels", () => {
    expect(fallFootballSeasonYear("Fall 2025")).toBeNull();
  });
});

describe("parseKickoffTime", () => {
  it("keeps 24-hour times and converts 12-hour kickoffs", () => {
    expect(parseKickoffTime("15:30")).toBe("15:30");
    expect(parseKickoffTime("19:30:00")).toBe("19:30");
    expect(parseKickoffTime("3:30 PM")).toBe("15:30");
    expect(parseKickoffTime("3:30PM")).toBe("15:30");
    expect(parseKickoffTime("7:00 p.m. ET")).toBe("19:00");
    expect(parseKickoffTime("12:00 PM")).toBe("12:00");
    expect(parseKickoffTime("12:00 AM")).toBe("00:00");
    expect(parseKickoffTime("Noon")).toBe("12:00");
  });

  it("drops unannounced times", () => {
    expect(parseKickoffTime("TBA")).toBeNull();
    expect(parseKickoffTime("")).toBeNull();
  });
});

describe("normalizeFootballGames", () => {
  it("keeps dated home and away games in chronological order", () => {
    expect(
      normalizeFootballGames([
        { name: "MSU vs. Iowa", date: "2025-10-04", startTime: "3:30 PM", venue: "Away" },
        { name: " MSU vs. Notre Dame ", date: "2025-09-20", startTime: "19:30", venue: "home" },
        { name: "   ", date: "2025-09-06", startTime: "12:00 PM", venue: "home" },
      ])
    ).toEqual([
      {
        name: "MSU vs. Notre Dame",
        date: "2025-09-20",
        startTime: "19:30",
        venue: "home",
      },
      {
        name: "MSU vs. Iowa",
        date: "2025-10-04",
        startTime: "15:30",
        venue: "away",
      },
    ]);
  });

  it("drops duplicate games and games outside the fall season", () => {
    const games = normalizeFootballGames([
      { name: "MSU vs. Notre Dame", date: "2025-09-20", startTime: "7:30 PM", venue: "home" },
      { name: "MSU vs. Notre Dame", date: "2025-09-20", startTime: "7:30 PM", venue: "home" },
      { name: "MSU vs. Spring Game", date: "2026-04-18", startTime: "12:00 PM", venue: "home" },
    ]);
    expect(filterGamesToFallSeason(games, 2025)).toEqual([
      {
        name: "MSU vs. Notre Dame",
        date: "2025-09-20",
        startTime: "19:30",
        venue: "home",
      },
    ]);
  });
});

describe("buildFootballScheduleUserPrompt", () => {
  it("passes campus clues and the season without naming a school", () => {
    const prompt = buildFootballScheduleUserPrompt({
      academicYearName: "2025-26",
      fallSeasonYear: 2025,
      context: {
        eventLocations: ["Campus Union"],
        recentEvents: [{ name: "Welcome Night", location: "Campus Union" }],
        roleNotes: ["Update the campus portal"],
      },
    });
    expect(prompt).toContain("2025-26");
    expect(prompt).toContain("Campus Union");
    expect(prompt).toContain("Search the web");
    expect(prompt).not.toMatch(/Michigan State|Notre Dame/);
  });
});
