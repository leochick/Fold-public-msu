import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/better-auth";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const u = await getCurrentUser();
  if (u) redirect("/");
  const sp = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    if (!email || !password) redirect("/login?error=missing");
    try {
      await auth.api.signInEmail({
        body: { email, password },
        headers: await headers(),
      });
    } catch {
      redirect("/login?error=invalid");
    }
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">✶ Fold</div>
          <div className="text-sm text-black/60 dark:text-white/60">Sign in to continue.</div>
        </div>
        {sp.error && (
          <div className="text-sm text-red-600">
            {sp.error === "invalid" ? "Invalid email or password." : "Please fill all fields."}
          </div>
        )}
        <div className="space-y-1">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <button className="btn-primary w-full" type="submit">Sign in</button>
        <p className="text-xs text-black/50 dark:text-white/40 text-center">
          Don't have an account? <Link href="/signup" className="underline">Create one</Link>
        </p>
      </form>
    </div>
  );
}
