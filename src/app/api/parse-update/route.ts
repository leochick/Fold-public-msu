export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "../../../../drizzle/schema";
import { anthropic, MODEL, UPDATE_STUDENTS_TOOL } from "@/lib/claude";
import { getCurrentUser } from "@/lib/auth";
import { inArray } from "drizzle-orm";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "missing text" }, { status: 400 });

  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      igHandle: students.igHandle,
      year: students.year,
      memberStatus: students.memberStatus,
      isActive: students.isActive,
    })
    .from(students);

  const rosterCompact = roster
    .map((r) =>
      `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${r.igHandle ? " (@" + r.igHandle + ")" : ""}|${r.year ?? ""}|${r.memberStatus ?? ""}|${r.isActive ? "active" : "inactive"}`
    )
    .join("\n");

  const system = `You translate a group organizer's free-text instruction into structured updates for the member database.
- Each update targets ONE student by their roster id.
- Match names fuzzily (Mike/Michael, Jess/Jessica), and consider IG handles. If a first-name is shared by multiple students, add the name to "ambiguous" instead of guessing.
- If the user wants to ADD a brand-new person who is NOT in the roster, use "creates" (not "updates"). Extract any attributes mentioned.
- Common phrasings:
  • "mark X as core" / "X is committed" → memberStatus: "core"
  • "X is a prospect" → memberStatus: "prospect"
  • "X is now a junior" → year: "junior"
  • "X is inactive" / "X stopped coming" → isActive: false
  • "X is in the IG group chat" / "added X to IG" → contactedViaIg: true
  • "X's phone is 555-..." → phone: "..."
  • "her primary contact is Aaron" → primaryContact: "Aaron"
  • "add Sarah Kim, sophomore" → creates with firstName, lastName, year, gender
  • Anything contextual ("mentioned interest in joining the study group") → use notesAppend, not notes.
- Use notesAppend for additive observations; only use notes (replace) when the user clearly says "set notes to ...".
- Be conservative: only set fields the user explicitly mentioned.`;

  const userMsg = `Roster (id|name (@ig)|year|status|active):\n${rosterCompact || "(empty)"}\n\nInstruction:\n${text}`;

  let resp;
  try {
    resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: [UPDATE_STUDENTS_TOOL],
      tool_choice: { type: "tool", name: UPDATE_STUDENTS_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "claude failed" },
      { status: 502 }
    );
  }

  const tu = resp.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") {
    return NextResponse.json({ error: "claude returned no tool use" }, { status: 502 });
  }
  const out = tu.input as {
    updates: { studentId: number; patch: Record<string, unknown> }[];
    creates?: Record<string, unknown>[];
    deletes?: { studentId: number; reason?: string }[];
    explanation: string;
    ambiguous?: string[];
  };

  // Hydrate "before" values for each update so the UI can show a diff
  const updateIds = (out.updates ?? []).map((u) => u.studentId).filter((n) => Number.isFinite(n));
  const deleteIds = (out.deletes ?? []).map((d) => d.studentId).filter((n) => Number.isFinite(n));
  const allIds = [...new Set([...updateIds, ...deleteIds])];
  const before = allIds.length ? await db.select().from(students).where(inArray(students.id, allIds)) : [];
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const previews = (out.updates ?? []).map((u) => ({
    studentId: u.studentId,
    before: beforeById.get(u.studentId) ?? null,
    patch: u.patch,
  }));
  const deletes = (out.deletes ?? []).map((d) => ({
    studentId: d.studentId,
    student: beforeById.get(d.studentId) ?? null,
    reason: d.reason ?? "",
  }));

  return NextResponse.json({
    explanation: out.explanation,
    ambiguous: out.ambiguous ?? [],
    previews,
    creates: out.creates ?? [],
    deletes,
  });
}
