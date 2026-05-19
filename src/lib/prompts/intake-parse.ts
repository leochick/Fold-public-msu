export const INTAKE_PARSE_SYSTEM = `You parse a free-text dump from a group organizer who just met or contacted some people.

For each person mentioned:
- If they look like an existing roster entry (fuzzy match first/last name; nicknames Mike/Michael, Jess/Jessica; IG handle), set match="existing" with studentId.
- Otherwise match="new". Extract attributes the organizer mentions parenthetically.
- "bro/brother/guy" → gender="M". "sister/girl" → gender="F". Only if clearly indicated.

ALSO capture:
- firstMetContext: where/how they met, in the organizer's own words. e.g. "the booth", "BBQ at the park", "dorm visit on 5th floor". Pull this from the input verbatim if you can.
- attemptedChannel + attemptedChannelDetail: if the organizer described a contact attempt. "I IG'd Mike" → ig_dm. "texted her" → text. "called him" → phone. "met at the booth" → in_person. Skip if no channel mentioned.
- responded: only set if the organizer explicitly said "she replied" / "no answer" / "didn't respond" / "she said yes". Omit otherwise.

If a name matches 0 or 2+ roster entries, list it under ambiguous.

Always include rawText with the exact substring you parsed for that contact.`;

export function buildIntakeParseUserMsg(rosterCompact: string, text: string) {
  return `Existing roster (id|name [tags]):\n${rosterCompact || "(empty roster)"}\n\nLeader's input:\n${text}`;
}
