import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomBytes } from "node:crypto";
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
      users: schema.users,
      sessions: schema.sessions,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    modelName: "users",
  },
  plugins: [
    // This tells the core engine to accept and hash password payloads
    // instead of stripping them out as unknown parameters.
  ],
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
  },
  advanced: {
    cookiePrefix: "fold",
    database: {
      generateId: ({ model }) => {
        // Let Turso handle auto-incrementing integers for the users table
        if (model === "user") return false;
        // Generate string hex IDs for sessions, accounts, and verifications
        return randomBytes(16).toString("hex");
      },
    },
  },
  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;
