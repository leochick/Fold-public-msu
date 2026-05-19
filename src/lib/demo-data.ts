function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ANCHOR = {
  headline: "Free food was the strongest single signal",
  evidence: "Avg 14 attendees at events with food vs 6 without, across 5 vs 3 events.",
};

function pool() {
  return [
    {
      headline: `On-campus events outpaced off-campus by ~${randInt(3, 7)} attendees`,
      evidence: `Avg ${randInt(12, 16)} on-campus across 6 events vs ${randInt(6, 10)} off-campus across 3 events.`,
    },
    {
      headline: `Friday socials drew higher attendance than weeknight studies`,
      evidence: `Avg ${randInt(13, 18)} on Fridays across 4 events vs ${randInt(6, 9)} on weeknights across 3 events.`,
    },
    {
      headline: `Invite ratio is strongest at worship-themed events`,
      evidence: `~${randInt(30, 40)}% of new attendees came via existing-student invites at worship events; ~${randInt(10, 20)}% at studies.`,
    },
    {
      headline: `October was the strongest month so far`,
      evidence: `October avg ${randInt(13, 17)} over 4 events; September avg ${randInt(8, 12)} over 5 events.`,
    },
    {
      headline: `Returner rate has been stable around ~${randInt(65, 75)}%`,
      evidence: `Returner ratio: 0.${randInt(67, 72)}, 0.${randInt(68, 73)}, 0.${randInt(67, 74)} over the last 3 weeks.`,
    },
    {
      headline: `First-time attendance trended down late semester`,
      evidence: `New attendees: ${randInt(7, 9)} in week 3, ${randInt(4, 6)} in week 6, ${randInt(1, 3)} in week 9.`,
    },
    {
      headline: `Invite chains concentrated in 3 core students`,
      evidence: `~${randInt(55, 65)}% of new attendees were brought by just 3 people; the rest of the roster invited fewer than 2 each.`,
    },
    {
      headline: `Weekly avg drifted upward through the term`,
      evidence: `Weekly avg: ${randInt(7, 9)} (Sept), ${randInt(10, 12)} (Oct), ${randInt(13, 16)} (Nov).`,
    },
  ];
}

export function mockInsights() {
  const p = shuffle(pool());
  const n = randInt(2, 4);
  return [ANCHOR, ...p.slice(0, n)];
}

export const DEMO_NOTICE =
  "AI features are disabled in this demo. Fork the repo, add your own Anthropic API key, and self-host to unlock parsing, ask, modify, and live insights.";

// ----- Intake parse -----

export function mockIntakeParse() {
  return {
    contacts: [
      {
        match: "new",
        firstName: "Maya",
        lastName: "Chen",
        gender: "F",
        year: "sophomore",
        igHandle: "mayachen",
        firstMetContext: "Brought by Sarah at boba night.",
        attemptedChannel: "ig_dm",
        responded: false,
        notes: "Asked about small groups.",
        rawText: "Maya Chen (@mayachen) - sophomore, came w/ Sarah, asked about small groups",
        contactId: "row:0",
        serverDedupCandidates: [],
      },
      {
        match: "new",
        firstName: "Jordan",
        lastName: "Park",
        gender: "M",
        year: "freshman",
        phone: "555-0142",
        firstMetContext: "Met at fall fest table.",
        attemptedChannel: "text",
        responded: true,
        rawText: "Jordan Park - frosh, met at fall fest, texted him, replied",
        contactId: "row:1",
        serverDedupCandidates: [],
      },
      {
        match: "new",
        firstName: "Lila",
        lastName: "Adeyemi",
        gender: "F",
        year: "junior",
        igHandle: "liladey",
        rawText: "Lila Adeyemi @liladey jr",
        contactId: "row:2",
        serverDedupCandidates: [],
      },
    ],
    ambiguous: [],
    explanation: "Parsed 3 new contacts from the input.",
  };
}

// ----- Parse attendance -----

export function mockParseAttendance() {
  return {
    attendees: [
      {
        match: "new",
        firstName: "Maya",
        lastName: "Chen",
        gender: "F",
        year: "sophomore",
        igHandle: "mayachen",
        memberStatus: "prospect",
        rawText: "Maya Chen",
      },
      {
        match: "new",
        firstName: "Jordan",
        lastName: "Park",
        gender: "M",
        year: "freshman",
        memberStatus: "prospect",
        rawText: "Jordan Park",
      },
      {
        match: "new",
        firstName: "Sam",
        lastName: "Rivera",
        gender: "M",
        year: "junior",
        memberStatus: "member",
        rawText: "Sam Rivera",
      },
      {
        match: "new",
        firstName: "Lila",
        lastName: "Adeyemi",
        gender: "F",
        year: "junior",
        rawText: "Lila Adeyemi",
      },
    ],
    explanation: "Parsed 4 attendees.",
  };
}

// ----- Parse event batch -----

export function mockParseEventBatch() {
  return {
    mode: "single" as const,
    event: {
      name: "Weekly 11/15",
      date: "2026-05-22",
      type: "Weekly",
      location: "Student Center 201",
      isNew: false,
    },
    attendees: mockParseAttendance().attendees,
  };
}

// ----- Parse update (Modify) -----

export function mockParseUpdate() {
  return {
    explanation: "I read this as 'mark Sam Rivera as core and add a note about being a small-group leader'.",
    ambiguous: [],
    previews: [],
    creates: [
      {
        firstName: "Eli",
        lastName: "Thompson",
        year: "sophomore",
        gender: "M",
        memberStatus: "prospect",
        notes: "New contact from worship night.",
      },
    ],
    deletes: [],
  };
}

// ----- NL query / Ask query mode -----

const SAMPLE_QUERY_ROWS = [
  { id: 1, firstName: "Maya", lastName: "Chen", gender: "F", year: "sophomore", memberStatus: "prospect", isActive: true, igHandle: "mayachen", phone: null, email: null, primaryContact: "Sarah", goals: null, notes: "Asked about small groups.", contactedViaIg: true, createdAt: null, addedById: null, updatedAt: null },
  { id: 2, firstName: "Jordan", lastName: "Park", gender: "M", year: "freshman", memberStatus: "prospect", isActive: true, igHandle: null, phone: "555-0142", email: null, primaryContact: null, goals: null, notes: null, contactedViaIg: false, createdAt: null, addedById: null, updatedAt: null },
  { id: 3, firstName: "Lila", lastName: "Adeyemi", gender: "F", year: "junior", memberStatus: "member", isActive: true, igHandle: "liladey", phone: null, email: null, primaryContact: null, goals: null, notes: null, contactedViaIg: false, createdAt: null, addedById: null, updatedAt: null },
  { id: 4, firstName: "Sam", lastName: "Rivera", gender: "M", year: "junior", memberStatus: "core", isActive: true, igHandle: null, phone: null, email: "sam.rivera@example.com", primaryContact: null, goals: "Lead a small group next year.", notes: "Invited 4 others this semester.", contactedViaIg: false, createdAt: null, addedById: null, updatedAt: null },
  { id: 5, firstName: "Eli", lastName: "Thompson", gender: "M", year: "sophomore", memberStatus: "prospect", isActive: true, igHandle: null, phone: null, email: null, primaryContact: null, goals: null, notes: "New contact from worship night.", contactedViaIg: false, createdAt: null, addedById: null, updatedAt: null },
];

export function mockNlQuery() {
  return {
    rows: SAMPLE_QUERY_ROWS,
    explanation: "Showing sample active students. (Real AI-generated queries require your own Anthropic key — self-host to enable.)",
    filters: { isActive: true },
  };
}

export function mockAskQuery() {
  return {
    mode: "query" as const,
    ...mockNlQuery(),
  };
}

// ----- Draft outreach -----

export function mockDraftOutreach(channel: string) {
  const drafts: Record<string, { label: string; body: string }[]> = {
    ig_dm: [
      { label: "Warm + casual", body: "hey! noticed you haven't been to weekly in a bit — totally no pressure, just wanted to check in. anything fun coming up for you this week?" },
      { label: "Direct invite", body: "hey, friday's weekly is going to be a worship night, would love to have you back if you can swing it" },
    ],
    text: [
      { label: "Check-in", body: "Hey, hope your week is going alright. We missed you at weekly the past couple Fridays. Anything going on, or just busy?" },
      { label: "Invite to coffee", body: "Hey, want to grab coffee sometime this week? Would love to catch up." },
    ],
    email: [
      { label: "Re-engagement", body: "Subject: Checking in\n\nHey,\n\nI realized it's been a few weeks since we've seen you at weekly. No pressure either way — just wanted to say we'd love to have you back if life slows down.\n\nLet me know if there's anything going on we can pray for.\n\nAndrew" },
    ],
    phone: [
      { label: "First 15 seconds", body: "Hey! It's Andrew. Got a minute? I just wanted to call and say hi — realized I haven't seen you in a bit and wanted to check in." },
    ],
    in_person: [
      { label: "Hallway opener", body: "Hey! Good to see you. I was just thinking about you actually — how's the semester going?" },
    ],
    other: [
      { label: "Short note", body: "Thinking of you this week — hope things are going well. Let me know if you ever want to grab coffee or chat." },
    ],
  };
  return {
    drafts: drafts[channel] ?? drafts.ig_dm,
    explanation: "Sample drafts shown in demo mode. Self-host with your own Anthropic key for personalized drafts based on the student's actual context.",
    channel,
  };
}

// ----- Rides parse -----

export function mockRidesParse() {
  return {
    riders: [
      { match: "new", firstName: "Maya", lastName: "Chen", gender: "F", rawText: "Maya", riderId: "rider:0", displayName: "Maya Chen" },
      { match: "new", firstName: "Jordan", lastName: "Park", gender: "M", rawText: "Jordan", riderId: "rider:1", displayName: "Jordan Park" },
      { match: "new", firstName: "Lila", lastName: "Adeyemi", gender: "F", rawText: "Lila", riderId: "rider:2", displayName: "Lila Adeyemi" },
      { match: "new", firstName: "Eli", lastName: "Thompson", gender: "M", rawText: "Eli", riderId: "rider:3", displayName: "Eli Thompson" },
    ],
    directives: {},
    ambiguous: [],
    explanation: "Parsed 4 riders from the input (demo).",
    vehicles: [],
    enforceGenderRule: false,
    assignments: [],
    unassigned: ["rider:0", "rider:1", "rider:2", "rider:3"],
    violations: [],
    warnings: [],
    unsatisfiable: [],
  };
}

// ----- Rides parse-fleet -----

export function mockRidesParseFleet() {
  return {
    vehicles: [
      { vehicleId: -1, name: "Andrew's Civic", capacity: 4, driverName: "Andrew", driverGender: "M" as const },
      { vehicleId: -2, name: "Sarah's CR-V", capacity: 5, driverName: "Sarah", driverGender: "F" as const },
    ],
    ambiguousVehicleNames: [],
    explanation: "Parsed 2 vehicles from the input (demo).",
  };
}
