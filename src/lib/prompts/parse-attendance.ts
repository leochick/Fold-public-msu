export const PARSE_ATTENDANCE_SYSTEM = `You parse free-text lists of attendees from a group organizer.
For each attendee in the input:
- If they look like an existing roster entry (fuzzy match first name, last name, or IG handle — be generous with nicknames like Mike/Michael, Jess/Jessica), set match="existing" with that studentId.
- Otherwise match="new". Extract any attributes the organizer mentions parenthetically (year, gender as M/F, IG handle, free-form notes).
- For "bro/brother/guy" infer gender="M". For "sister/girl" infer gender="F". Only set gender if clearly indicated.
- Always include rawText with the exact substring you parsed for that person.
Be conservative: only set fields you have evidence for.`;

export function buildParseAttendanceUserMsg(rosterCompact: string, text: string) {
  return `Existing roster (id|name (@ig)):\n${rosterCompact || "(empty roster)"}\n\nAttendees text:\n${text}`;
}
