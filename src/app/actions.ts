"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/better-auth";
import { isDemoMode } from "@/lib/auth";

export async function destroySessionAction() {
  if (isDemoMode()) {
    redirect("/");
  }
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
