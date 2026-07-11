import { db } from "@/lib/db";
import { students, contactAttempts, users } from "../../drizzle/schema";
import { anthropic, MODEL } from "@/lib/claude";
import { PARSE_INTAKE_TOOL } from "@/lib/funnel/claude-tools";
import { findPossibleDuplicates } from "@/lib/funnel/dedup";
import { INTAKE_PARSE_SYSTEM, buildIntakeParseUserMsg } from "@/lib/prompts/intake-parse";
import { httpErr } from "@/lib/http";
import { callClaudeOrThrow } from "./attendance";
import type { ParsedContact, IntakePreview, DedupCandidateWithName } from "@/lib/funnel/types";
import { logStudentCreated } from "./changelog";

interface IntakeToolInput {
  contacts?: Array<Omit<ParsedContact, "contactId" | "serverDedupCandidates" | "existingDisplayName"> & {
    studentId?: number;
  }>;
  explanation?: string;
  ambiguous?: string[];
}

export async function parseIntake(text: string): Promise<IntakePreview> {
  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
      year: students.year,
      igHandle: students.igHandle,
      phone: students.phone,
      email: students.email,
      createdAt: students.createdAt,
      addedByUserId: students.addedByUserId,
    })
    .from(students);

  const allUsers = await db.select({ id: users.id, displayName: users.name }).from(users);
  const userById = new Map(allUsers.map((u) => [u.id, u.displayName]));

  const rosterCompact = roster
    .map((r) => {
      const tags: string[] = [];
      if (r.gender) tags.push(r.gender);
      if (r.year) tags.push(r.year);
      if (r.igHandle) tags.push(`@${r.igHandle}`);
      const tail = tags.length ? ` [${tags.join(", ")}]` : "";
      return `${r.id}|${r.firstName}${r.lastName ? " " + r.lastName : ""}${tail}`;
    })
    .join("\n");

  const userMsg = buildIntakeParseUserMsg(rosterCompact, text);
  const resp = await callClaudeOrThrow(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: INTAKE_PARSE_SYSTEM,
      tools: [PARSE_INTAKE_TOOL],
      tool_choice: { type: "tool", name: PARSE_INTAKE_TOOL.name },
      messages: [{ role: "user", content: userMsg }],
    })
  );

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw httpErr.upstream("claude returned no tool use");

  const input = toolUse.input as IntakeToolInput;
  const rosterById = new Map(roster.map((r) => [r.id, r]));
  const now = new Date();

  const contacts: ParsedContact[] = (input.contacts ?? []).map((c, i) => {
    const base: ParsedContact = {
      ...c,
      contactId: `row:${i}`,
      serverDedupCandidates: [],
    };

    if (c.match === "existing" && typeof c.studentId === "number") {
      const r = rosterById.get(c.studentId);
      if (r) base.existingDisplayName = `${r.firstName}${r.lastName ? " " + r.lastName : ""}`;
      return base;
    }

    const candidates = findPossibleDuplicates(
      {
        firstName: c.firstName ?? "",
        lastName: c.lastName,
        igHandle: c.igHandle,
        phone: c.phone,
        email: c.email,
      },
      roster,
      now
    );
    const enriched: DedupCandidateWithName[] = candidates.slice(0, 5).map((cand) => {
      const r = rosterById.get(cand.studentId)!;
      return {
        ...cand,
        displayName: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
        addedByDisplayName: r.addedByUserId ? userById.get(r.addedByUserId) : undefined,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    });
    base.serverDedupCandidates = enriched;
    return base;
  });

  return {
    contacts,
    ambiguous: input.ambiguous ?? [],
    explanation:
      input.explanation ??
      `Parsed ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`,
  };
}

export async function commitIntake(userId: string, contacts: ParsedContact[]) {
  let created = 0;
  let attemptsLogged = 0;

  for (const c of contacts) {
    let sid: number | undefined;
    if (c.match === "existing" && typeof c.studentId === "number") {
      sid = c.studentId;
    } else if (c.match === "new" && c.firstName) {
      const [row] = await db
        .insert(students)
        .values({
          firstName: c.firstName,
          lastName: c.lastName ?? null,
          gender: c.gender ?? null,
          year: (c.year as never) ?? null,
          igHandle: c.igHandle ?? null,
          phone: c.phone ?? null,
          email: c.email ?? null,
          notes: c.notes ?? null,
          addedByUserId: userId,
          firstMetContext: c.firstMetContext ?? null,
          firstMetAt: new Date(),
        })
        .returning();
      sid = row.id;
      await logStudentCreated(userId, row, "Smart Intake");
      created += 1;
    }
    if (!sid) continue;

    const attempted = !!c.attemptedChannel;
    const responded = !!c.responded;

    if (attempted) {
      await db.insert(contactAttempts).values({
        studentId: sid,
        attemptedByUserId: userId,
        channel: c.attemptedChannel!,
        channelDetail: c.attemptedChannelDetail ?? null,
        responded,
        notes: c.notes ?? null,
      });
      attemptsLogged += 1;
    }
  }
  return { ok: true, created, attemptsLogged };
}
