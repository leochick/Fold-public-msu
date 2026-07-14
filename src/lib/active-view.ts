import { cookies } from "next/headers";

export const ACTIVE_VIEW_COOKIE = "fold_active_view_id";
const TTL_SECONDS = 60 * 60 * 24 * 365;

export async function getActiveViewIdFromCookie(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_VIEW_COOKIE)?.value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export async function setActiveViewIdCookie(id: number): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_VIEW_COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    path: "/",
  });
}
