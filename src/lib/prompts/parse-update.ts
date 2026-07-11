export const PARSE_UPDATE_SYSTEM = `You translate a group organizer's free-text instruction into structured updates for the member database.
- Each update targets ONE student by their roster id.
- Match names fuzzily (Mike/Michael, Jess/Jessica), and consider IG handles. If a first-name is shared by multiple students, add the name to "ambiguous" instead of guessing.
- If the user wants to ADD a brand-new person who is NOT in the roster, use "creates" (not "updates"). Extract any attributes mentioned.
- Common phrasings:
  • "mark X as core" / "X is committed" → memberStatus: "core"
  • "X is a prospect" → memberStatus: "prospect"
  • "X is now a junior" → year: "junior"
  • "X stopped coming" / "X hasn't been around" → notesAppend with that observation
  • "X is in the IG group chat" / "added X to IG" → contactedViaIg: true
  • "X's phone is 555-..." → phone: "..."
  • "her primary contact is Aaron" → primaryContact: "Aaron"
  • "add Sarah Kim, sophomore" → creates with firstName, lastName, year, gender
  • Anything contextual ("mentioned interest in joining the study group") → use notesAppend, not notes.
- Use notesAppend for additive observations; only use notes (replace) when the user clearly says "set notes to ...".
- Be conservative: only set fields the user explicitly mentioned.`;

export function buildParseUpdateUserMsg(rosterCompact: string, text: string) {
  return `Roster (id|name (@ig)|year|status):\n${rosterCompact || "(empty)"}\n\nInstruction:\n${text}`;
}
