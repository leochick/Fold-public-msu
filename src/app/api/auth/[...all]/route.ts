/**
 * Better Auth handler mount point.
 *
 * This route is wired but currently NOT in use — the bespoke bcrypt+cookie auth in
 * src/lib/auth.ts still handles all live traffic. Activating better-auth requires
 * the schema migration described in src/lib/better-auth.ts.
 *
 * Once the schema is in place, this route will serve:
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-in/email
 *   POST /api/auth/sign-out
 *   GET  /api/auth/get-session
 *   ... and the rest of the better-auth surface area.
 */
import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
