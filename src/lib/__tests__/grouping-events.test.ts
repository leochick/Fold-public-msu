import { describe, expect, it } from "vitest";
import {
  areAllNonTablingEventsChecked,
  areAllTablingEventsChecked,
  formatGroupingEventSelection,
  isGroupingEventChecked,
  studentMatchesGroupingEvents,
  toggleAllNonTablingEvents,
  toggleAllTablingEvents,
  toggleGroupingEvent,
} from "@/lib/grouping-events";

const events = [
  { id: 1, type: "Weekly" },
  { id: 2, type: "Social" },
  { id: 3, type: "Tabling" },
  { id: 4, type: "tabling" },
];

describe("formatGroupingEventSelection", () => {
  const names = new Map([
    [1, "Spring Retreat"],
    [2, "Weekly Meeting"],
  ]);

  it("returns All non-tabling events when null", () => {
    expect(formatGroupingEventSelection(null, names)).toBe("All non-tabling events");
  });

  it("returns Various events for multiple selections", () => {
    expect(formatGroupingEventSelection([1, 2], names)).toBe("Various events");
  });

  it("returns the event name for a single selection", () => {
    expect(formatGroupingEventSelection([1], names)).toBe("Spring Retreat");
  });
});

describe("grouping event selection toggles", () => {
  it("treats null as all non-tabling events checked", () => {
    expect(areAllNonTablingEventsChecked(null, events)).toBe(true);
    expect(areAllTablingEventsChecked(null, events)).toBe(false);
    expect(isGroupingEventChecked(1, null, events)).toBe(true);
    expect(isGroupingEventChecked(3, null, events)).toBe(false);
  });

  it("toggles all non-tabling without affecting tabling selection", () => {
    const withTabling = toggleAllTablingEvents(null, events);
    expect(areAllTablingEventsChecked(withTabling, events)).toBe(true);
    expect(areAllNonTablingEventsChecked(withTabling, events)).toBe(true);

    const withoutNonTabling = toggleAllNonTablingEvents(withTabling, events);
    expect(areAllNonTablingEventsChecked(withoutNonTabling, events)).toBe(false);
    expect(areAllTablingEventsChecked(withoutNonTabling, events)).toBe(true);
    expect(isGroupingEventChecked(3, withoutNonTabling, events)).toBe(true);
    expect(isGroupingEventChecked(1, withoutNonTabling, events)).toBe(false);
  });

  it("toggles tabling contacts without affecting non-tabling selection", () => {
    const onlyWeekly = toggleGroupingEvent(2, null, events);
    expect(areAllNonTablingEventsChecked(onlyWeekly, events)).toBe(false);

    const withTabling = toggleAllTablingEvents(onlyWeekly, events);
    expect(isGroupingEventChecked(1, withTabling, events)).toBe(true);
    expect(isGroupingEventChecked(2, withTabling, events)).toBe(false);
    expect(areAllTablingEventsChecked(withTabling, events)).toBe(true);

    const withoutTabling = toggleAllTablingEvents(withTabling, events);
    expect(areAllTablingEventsChecked(withoutTabling, events)).toBe(false);
    expect(isGroupingEventChecked(1, withoutTabling, events)).toBe(true);
    expect(isGroupingEventChecked(2, withoutTabling, events)).toBe(false);
  });

  it("collapses back to null when only all non-tabling remain", () => {
    const withTabling = toggleAllTablingEvents(null, events);
    expect(toggleAllTablingEvents(withTabling, events)).toBeNull();
  });
});

describe("studentMatchesGroupingEvents", () => {
  it("includes newsletter-only students when newsletter contacts are enabled", () => {
    expect(
      studentMatchesGroupingEvents({
        attendedEventIds: [],
        newsletter: true,
        checkedEventIds: null,
        includeNewsletterContacts: true,
        events,
      })
    ).toBe(true);

    expect(
      studentMatchesGroupingEvents({
        attendedEventIds: [],
        newsletter: true,
        checkedEventIds: null,
        includeNewsletterContacts: false,
        events,
      })
    ).toBe(false);
  });

  it("includes tabling-only students when tabling events are checked", () => {
    const withTabling = toggleAllTablingEvents([], events);
    expect(
      studentMatchesGroupingEvents({
        attendedEventIds: [3],
        newsletter: false,
        checkedEventIds: withTabling,
        includeNewsletterContacts: false,
        events,
      })
    ).toBe(true);

    expect(
      studentMatchesGroupingEvents({
        attendedEventIds: [3],
        newsletter: false,
        checkedEventIds: null,
        includeNewsletterContacts: false,
        events,
      })
    ).toBe(false);
  });

  it("matches non-tabling attendees when all non-tabling is selected", () => {
    expect(
      studentMatchesGroupingEvents({
        attendedEventIds: [1],
        newsletter: false,
        checkedEventIds: null,
        includeNewsletterContacts: false,
        events,
      })
    ).toBe(true);
  });
});
