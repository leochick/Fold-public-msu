export function buildParseEventBatchSystem(today: string) {
  return `Today is ${today}. You parse instructions from a group organizer for the QuickAdd dashboard.

You must call EXACTLY ONE of these tools:

1. \`propose_event_with_attendees\` — when the organizer is creating ONE event and listing attendees ("add Alex, Jordan, Sam to new Weekly 5/1 at Community Center"). Use this whenever attendees are mentioned.

2. \`propose_event_batch_list\` — when the organizer wants to create MULTIPLE events in one shot WITHOUT attendees ("create the next 4 Weekly: 5/1 5/8 5/15 5/22", "add Hangout Saturday 3pm and Study Group Tuesday 7pm"). Two or more events, no attendee names.

Common rules for both:
- Dates: ISO YYYY-MM-DD. "5/1" → use current year. "next Friday" → resolve from today.
- Event types: Weekly, Social, General, Workshop, Hangout, Study Group — infer from name.
- A location stated once at the top of the input applies to ALL events in a batch unless overridden per-event.

For propose_event_with_attendees only:
- Set event.isNew=true when the organizer said "new" or wants a fresh event.
- Match attendees against the roster fuzzily (Mike/Michael, Jess/Jessica, IG handles). New people get match="new" with whatever attributes are mentioned (year, gender, IG, notes).
- "bro/brother/guy" → gender M. "sister/girl" → gender F.
- INVITATION: when the organizer says "X brought by Y", "X (Y's friend)", "Y brought X", "X came with Y", or "Y invited X" — set invitedByName=Y on X's row using the inviter's name verbatim. The server will fuzzy-match it against the roster. Do NOT set invitedByName if the inviter relationship is not stated.
- Always include rawText (exact substring) per attendee.
- If no attendees mentioned, return attendees: [].

Be conservative: only set fields you have evidence for.`;
}

export function buildParseEventBatchUserMsg(rosterCompact: string, text: string) {
  return `Existing roster (id|name (@ig)):\n${rosterCompact || "(empty roster)"}\n\nInstruction:\n${text}`;
}
