import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { users, account, students, events, attendances, sessions } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

const TODAY = new Date("2026-05-19T00:00:00Z");
const N_WEEKS = 16;

let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

async function main() {
  console.log("Wiping previous demo data...");
  await db.delete(attendances);
  await db.delete(events);
  await db.delete(students);
  await db.delete(sessions);
  await db.delete(account);
  await db.delete(users);

  const hash = bcrypt.hashSync("password1234", 10);
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      displayName: "Andrew (demo)",
      passwordHash: hash,
    })
    .returning();
  await db.insert(account).values({
    id: randomBytes(16).toString("hex"),
    accountId: String(admin.id),
    providerId: "credential",
    userId: admin.id,
    password: hash,
  });
  console.log("Created admin user");

  // Friday calendar: 16 weeks back from today
  const startingDayOfWeek = TODAY.getUTCDay();
  const daysBackToLastFriday = (startingDayOfWeek - 5 + 7) % 7;
  const eventsToInsert: Array<{
    name: string;
    type: string;
    location: string;
    startDate: Date;
  }> = [];
  for (let w = 0; w < N_WEEKS; w++) {
    const weeksBack = N_WEEKS - 1 - w;
    const totalDaysBack = daysBackToLastFriday + weeksBack * 7;
    const friday = new Date(TODAY.getTime() - totalDaysBack * 86_400_000);
    friday.setUTCHours(18, 0, 0, 0);
    const m = friday.getUTCMonth() + 1;
    const d = friday.getUTCDate();
    eventsToInsert.push({
      name: `Weekly ${m}/${d}`,
      type: "Weekly",
      location: "Student Center 201",
      startDate: friday,
    });
  }
  // Sprinkle specials at weeks 3 (Worship), 9 (Social), 13 (Retreat)
  eventsToInsert[3] = {
    name: "Worship Night",
    type: "Worship",
    location: "Chapel",
    startDate: eventsToInsert[3].startDate,
  };
  eventsToInsert[9] = {
    name: "Boba & Boardgames",
    type: "Social",
    location: "Campion Tower",
    startDate: eventsToInsert[9].startDate,
  };
  eventsToInsert[13] = {
    name: "Spring Retreat",
    type: "Retreat",
    location: "Mt Vernon",
    startDate: eventsToInsert[13].startDate,
  };

  const createdEvents = await db.insert(events).values(eventsToInsert).returning();
  console.log(`Created ${createdEvents.length} events spanning ~4 months`);

  const firstNames = [
    "Maya", "Jordan", "Lila", "Sam", "Eli", "Sarah", "Joshua", "Hannah", "David", "Rachel",
    "Caleb", "Grace", "Daniel", "Esther", "Nathan", "Ruth", "Andrew", "Naomi", "Peter", "Mary",
    "John", "Priscilla", "Mark", "Lydia", "Luke", "Anna", "Paul", "Phoebe", "Stephen", "Tabitha",
    "Timothy", "Aliyah", "Ezra", "Junia", "Isaac", "Miriam", "Asa", "Sela",
  ];
  const lastNames = [
    "Chen", "Park", "Adeyemi", "Rivera", "Thompson", "Kim", "Nguyen", "Lee", "Garcia", "Patel",
    "Choi", "Singh", "Tran", "Wong", "Lopez", "Brown", "Davis", "Wilson", "Martinez", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Martin", "Clark", "Lewis", "Walker", "Young", "Allen",
    "King", "Wright", "Scott", "Green", "Baker", "Hayashi", "Okonkwo", "Reyes",
  ];

  const years = ["freshman", "sophomore", "junior", "senior", "grad"] as const;
  const N_STUDENTS = 38;
  const studentsToInsert: Array<{
    firstName: string;
    lastName: string;
    gender: "M" | "F";
    year: (typeof years)[number];
    memberStatus: "prospect" | "member" | "core";
    funnelStage: "active";
    isActive: boolean;
    addedByUserId: number;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < N_STUDENTS; i++) {
    let createdAt: Date;
    if (i < 18) {
      // Joined around the start of the term
      const t = new Date(createdEvents[0].startDate);
      t.setUTCDate(t.getUTCDate() - Math.floor(rand() * 6));
      createdAt = t;
    } else if (i < 30) {
      // Joined sometime in the middle weeks
      const evtIdx = 3 + Math.floor(rand() * 7);
      const t = new Date(createdEvents[evtIdx].startDate);
      t.setUTCDate(t.getUTCDate() + Math.floor(rand() * 4));
      createdAt = t;
    } else {
      // Joined in the last 30 days
      const t = new Date(TODAY);
      t.setUTCDate(t.getUTCDate() - Math.floor(rand() * 28));
      createdAt = t;
    }
    const r = rand();
    const memberStatus =
      r < 0.15 ? "core" : r < 0.5 ? "member" : "prospect";
    studentsToInsert.push({
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[(i * 7) % lastNames.length],
      gender: rand() < 0.5 ? "M" : "F",
      year: years[Math.floor(rand() * years.length)],
      memberStatus,
      funnelStage: "active",
      isActive: true,
      addedByUserId: admin.id,
      createdAt,
    });
  }

  const createdStudents = await db.insert(students).values(studentsToInsert).returning();
  console.log(`Created ${createdStudents.length} students`);

  // Invite chains: link some students to earlier-joined inviters
  for (let i = 10; i < createdStudents.length; i += 2) {
    const inviter = createdStudents[i % 8];
    await db.run(
      sql`UPDATE students SET invited_by_student_id = ${inviter.id} WHERE id = ${createdStudents[i].id}`
    );
  }
  console.log("Linked invite chains");

  // Attendance growth curve
  let attCount = 0;
  for (let w = 0; w < N_WEEKS; w++) {
    const evt = createdEvents[w];
    let target: number;
    if (w < 4) target = 5 + Math.floor(rand() * 3);
    else if (w < 8) target = 9 + Math.floor(rand() * 3);
    else if (w < 12) target = 12 + Math.floor(rand() * 4);
    else target = 16 + Math.floor(rand() * 4);
    if (evt.type === "Worship" || evt.type === "Retreat" || evt.type === "Social") {
      target += 3;
    }

    const eligible = createdStudents.filter(
      (s) => s.createdAt && new Date(s.createdAt) <= evt.startDate
    );
    if (eligible.length === 0) continue;
    const cap = Math.min(target, eligible.length);
    const shuffled = [...eligible].sort(() => rand() - 0.5).slice(0, cap);

    const recordedAt = new Date(evt.startDate);
    recordedAt.setUTCHours(20, 0, 0, 0);

    for (const s of shuffled) {
      await db.insert(attendances).values({
        studentId: s.id,
        eventId: evt.id,
        recordedBy: admin.id,
        recordedAt,
      });
      attCount++;
    }
  }
  console.log(`Created ${attCount} attendance records (5 → 19/week growth curve)`);

  client.close();
  console.log("\nDemo seed complete.");
}

main();
