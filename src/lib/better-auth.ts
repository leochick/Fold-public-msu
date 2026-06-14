import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "../../drizzle/schema";
import { nextCookies } from "better-auth/next-js";

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
    nextCookies()
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
    },
  },
  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;
