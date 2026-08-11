import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/better-auth";
import { getCurrentUser } from "@/lib/auth";
import {
  ALLOWED_SIGNUP_DOMAIN,
  isAllowedSignupEmail,
  signupDomainErrorMessage,
} from "@/lib/signup-domain";

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

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const displayName = String(formData.get("name") || formData.get("displayName") || "").trim();

    if (!email || !password || !displayName) {
      redirect("/signup?error=missing");
    }
    if (!email.includes("@") || email.length < 5) {
      redirect("/signup?error=email");
    }
    if (!isAllowedSignupEmail(email)) {
      redirect("/signup?error=domain");
    }
    if (password.length < 12) {
      redirect("/signup?error=short");
    }

    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: displayName,
        },
        headers: resolvedHeaders,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (/already exists|user.*exists|USER_ALREADY_EXISTS/i.test(message)) {
        redirect("/signup?error=taken");
      }
      if (/acts2\.network|allowed.*domain|email.*domain/i.test(message)) {
        redirect("/signup?error=domain");
      }
      redirect("/signup?error=invalid");
    }

    redirect("/");
  }

  const errorMsg =
    sp.error === "missing" ? "Please fill all fields."
    : sp.error === "email" ? "That doesn't look like a valid email."
    : sp.error === "domain" ? signupDomainErrorMessage()
    : sp.error === "short" ? "Password must be at least 12 characters."
    : sp.error === "taken" ? "An account already exists for that email — try signing in instead."
    : sp.error === "invalid" ? "Couldn't create your account. Please try again."
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form action={signup} className="card w-full max-w-sm space-y-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">✶ Fold</div>
          <div className="text-sm text-black/60 dark:text-white/60">Create your account.</div>
        </div>
        {errorMsg && (
          <div role="alert" className="text-sm text-red-600">
            {errorMsg}
          </div>
        )}
        <div className="space-y-1">
          <label className="label" htmlFor="displayName">Your name</label>
          <input id="displayName" name="name" required className="input" placeholder="e.g. Alex Rivera" />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder={`you@${ALLOWED_SIGNUP_DOMAIN}`}
          />
          <p className="text-xs text-black/50 dark:text-white/40">
            Must be an @{ALLOWED_SIGNUP_DOMAIN} address.
          </p>
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
