import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/better-auth";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const u = await getCurrentUser();
  if (u) redirect("/");
  const sp = await searchParams;

  async function signup(formData: FormData) {
  "use server";

  const resolvedHeaders = await headers();

  const targetEmail = String(formData.get("email") || "").trim().toLowerCase();
  const targetPassword = String(formData.get("password") || "");
  const targetName = String(formData.get("name") || "").trim();

  if (!targetEmail || !targetPassword || !targetName) {
    redirect("/signup?error=missing");
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: targetEmail,
        password: targetPassword,
        name: targetName
      },
      headers: resolvedHeaders,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    redirect("/signup?error=invalid");
  }

  redirect("/");
}

  const errorMsg =
    sp.error === "missing" ? "Please fill all fields."
    : sp.error === "email" ? "That doesn't look like a valid email."
    : sp.error === "domain" ? `Only @${process.env.ALLOWED_DOMAIN} emails can sign up.`
    : sp.error === "short" ? "Password must be at least 12 characters."
    : sp.error === "taken" ? "An account already exists for that email — try signing in instead."
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={signup} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">✶ Fold</div>
          <div className="text-sm text-black/60 dark:text-white/60">Create your account.</div>
        </div>
        {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
        <div className="space-y-1">
          <label className="label" htmlFor="displayName">Your name</label>
          <input id="displayName" name="displayName" required className="input" placeholder="e.g. Alex Rivera" />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className="input" />
          <p className="text-xs text-black/50">12+ characters.</p>
        </div>
        <button className="btn-primary w-full" type="submit">Create account</button>
        <p className="text-xs text-black/50 dark:text-white/40 text-center">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
