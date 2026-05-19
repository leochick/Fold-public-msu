import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import * as schema from "../../drizzle/schema";

const baseURL =
  process.env.BETTER_AUTH_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const auth = betterAuth({
  baseURL,
  secret: process.env.AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.account,
      verification: schema.verification,
    },
    usePlural: false,
  }),
  user: {
    modelName: "users",
    fields: {
      name: "displayName",
    },
    additionalFields: {
      passwordHash: { type: "string", required: false, input: false },
    },
  },
  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: { modelName: "account" },
  verification: { modelName: "verification" },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    autoSignIn: true,
    // Use bcrypt so the backfilled hashes from the pre-better-auth era still verify.
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  advanced: {
    cookiePrefix: "fold",
    database: {
      // users.id is integer autoincrement — tell BA to let SQLite generate it.
      // session/account/verification use text PKs — we generate hex ids.
      generateId: ({ model }) => {
        if (model === "user") return false;
        return randomBytes(16).toString("hex");
      },
    },
  },
  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;
