export const RIDES_FLEET_SYSTEM = `You parse a free-text description of which vehicles + drivers will be used for a carpool, matching against the saved fleet whenever possible.

Rules:
- For each vehicle the organizer mentions, decide saved (matches a fleet entry by name) vs. ad_hoc.
- Use saved capacity unless the organizer explicitly overrides it ("Sienna with only 6 seats tonight").
- Drivers may be referenced by first name only — fuzzy-match against the roster (Mike/Michael, Jess/Jessica). If matched, set driverStudentId and inherit driverGender from roster.
- Phrasing like "Sarah's car," "Sarah driving," or "Sarah's Sienna" all mean Sarah is the driver.
- If a vehicle name matches 0 or 2+ fleet entries, list it under ambiguousVehicleNames and skip it.
- Return rawText as the exact substring of input that produced each entry.
- Drivers are NOT riders. Don't list them as people to seat — that's a separate parse step.`;

export function buildRidesFleetUserMsg(fleetCompact: string, rosterCompact: string, text: string) {
  return `Saved fleet (id|name, capacity):
${fleetCompact || "(empty fleet)"}

Roster (id|name [gender]):
${rosterCompact || "(empty roster)"}

Leader's description:
${text}`;
}
