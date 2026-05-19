"use server";

import { destroySession, isDemoMode } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function destroySessionAction() {
  if (isDemoMode()) {
    redirect("/");
  }
  await destroySession();
  redirect("/login");
}
