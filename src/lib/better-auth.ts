import { betterAuth, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "../../drizzle/schema";
import { nextCookies } from "better-auth/next-js";
import { isAllowedSignupEmail, signupDomainErrorMessage } from "./signup-domain";

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
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedSignupEmail(String(user.email ?? ""))) {
            throw new APIError("BAD_REQUEST", {
              message: signupDomainErrorMessage(),
            });
          }
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "fold",
    database: {
    },
  },
  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;
