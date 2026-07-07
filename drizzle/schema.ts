import { sqliteTable, text, integer, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name").notNull(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- BETTER AUTH ---
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
// --- /BETTER AUTH ---

// --- DEMO SPEND CAP ---
// In demo mode we charge real Anthropic calls but cap each anonymous visitor's spend
// (keyed on the fold_demo_id cookie) at $1 to prevent abuse.
export const demoSpend = sqliteTable("demo_spend", {
  id: text("id").primaryKey(),
  spentCents: integer("spent_cents").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
// --- /DEMO SPEND CAP ---

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  studentId: text("student_id"),
  gender: text("gender", { enum: ["M", "F"] }),
  year: text("year", { enum: ["freshman", "sophomore", "junior", "senior", "grad", "other"] }),
  phone: text("phone"),
  email: text("email"),
  igHandle: text("ig_handle"),
  memberStatus: text("member_status", { enum: ["prospect", "member", "core"] }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  newsletter: integer("newsletter", { mode: "boolean" }).notNull().default(false),
  groupme: integer("groupme", { mode: "boolean" }).notNull().default(false),
  contactedViaIg: integer("contacted_via_ig", { mode: "boolean" }).notNull().default(false),
  primaryContact: text("primary_contact"),
  goals: text("goals"),
  notes: text("notes"),
  courseMaterial: text("course_material", { mode: "json" }).$type<string[]>(),
  // --- WELCOME FUNNEL ---
  addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  firstMetContext: text("first_met_context"),
  firstMetAt: integer("first_met_at", { mode: "timestamp" }),
  funnelStage: text("funnel_stage", {
    enum: ["new", "reaching_out", "connected", "met", "active", "engaged", "inactive"],
  })
    .notNull()
    .default("new"),
  // --- /WELCOME FUNNEL ---
  // --- HEALTH METRICS ---
  invitedByStudentId: integer("invited_by_student_id").references((): AnySQLiteColumn => students.id, {
    onDelete: "set null",
  }),
  // --- /HEALTH METRICS ---
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type"),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  location: text("location"),
  notes: text("notes"),
  totalStudents: integer("total_students"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const attendances = sqliteTable(
  "attendances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    recordedBy: text("recorded_by").references(() => users.id, { onDelete: "set null" }),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    notes: text("notes"),
  },
  (t) => ({
    uniqStudentEvent: uniqueIndex("uniq_student_event").on(t.studentId, t.eventId),
  })
);

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  page: text("page"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- WELCOME FUNNEL ---
export const funnelSweepLog = sqliteTable("funnel_sweep_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runAt: integer("run_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  thresholdDays: integer("threshold_days").notNull(),
  evaluated: integer("evaluated").notNull(),
  flippedCount: integer("flipped_count").notNull(),
  flipped: text("flipped", { mode: "json" }).$type<Array<{ studentId: number; from: string }>>(),
  triggeredBy: text("triggered_by", { enum: ["manual", "scheduled"] }).notNull().default("manual"),
});

export const contactAttempts = sqliteTable("contact_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  attemptedByUserId: text("attempted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  channel: text("channel", { enum: ["ig_dm", "text", "phone", "email", "in_person", "other"] }).notNull(),
  channelDetail: text("channel_detail"),
  attemptedAt: integer("attempted_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  responded: integer("responded", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
// --- /WELCOME FUNNEL ---

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Attendance = typeof attendances.$inferSelect;
export type User = typeof users.$inferSelect;
export type ContactAttempt = typeof contactAttempts.$inferSelect;
export type NewContactAttempt = typeof contactAttempts.$inferInsert;
export type FunnelStage = NonNullable<Student["funnelStage"]>;
export type FunnelSweepLog = typeof funnelSweepLog.$inferSelect;

export const views = sqliteTable("views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type View = typeof views.$inferSelect;
export type NewView = typeof views.$inferInsert;

export type GroupingContainerData = {
  title: string;
  studentIds: number[];
};

export const groupings = sqliteTable("groupings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  viewId: integer("view_id")
    .notNull()
    .references(() => views.id, { onDelete: "cascade" }),
  checkedEventIds: text("checked_event_ids", { mode: "json" }).$type<number[]>(),
  containers: text("containers", { mode: "json" }).$type<GroupingContainerData[]>().notNull(),
  addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Grouping = typeof groupings.$inferSelect;
export type NewGrouping = typeof groupings.$inferInsert;

export const changelogEntries = sqliteTable("changelog_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: text("entity_type", { enum: ["student", "event"] }).notNull(),
  entityId: integer("entity_id"),
  action: text("action", { enum: ["create", "update", "delete", "merge"] }).notNull(),
  entityLabel: text("entity_label").notNull(),
  summary: text("summary").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type NewChangelogEntry = typeof changelogEntries.$inferInsert;
