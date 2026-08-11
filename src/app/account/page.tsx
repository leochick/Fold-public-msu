import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/better-auth";
import { getCurrentUser, isDemoMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 12;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const demo = isDemoMode();

  async function changePassword(formData: FormData) {
    "use server";

    if (isDemoMode()) {
      redirect("/account?error=" + encodeURIComponent("Password changes are disabled in demo mode."));
    }

    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      redirect("/account?error=" + encodeURIComponent("Please fill all password fields."));
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      redirect(
        "/account?error=" +
          encodeURIComponent(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      );
    }
    if (newPassword !== confirmPassword) {
      redirect("/account?error=" + encodeURIComponent("New passwords do not match."));
    }
    if (newPassword === currentPassword) {
      redirect(
        "/account?error=" +
          encodeURIComponent("New password must be different from your current password.")
      );
    }

    try {
      await auth.api.changePassword({
        body: {
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
      redirect("/account?error=" + encodeURIComponent("Current password is incorrect."));
    }

    redirect("/account?saved=1");
  }

  const errorMsg = sp.error ? decodeURIComponent(sp.error) : "";

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Your Fold sign-in details.
        </p>
      </div>

      {sp.saved && (
        <div className="text-sm text-green-700 dark:text-green-400">
          Your password has been updated.
        </div>
      )}
      {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="space-y-1">
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={user.name} readOnly disabled />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={user.email}
            readOnly
            disabled
          />
        </div>
        <div className="space-y-1">
          <label className="label" htmlFor="password-display">Password</label>
          <input
            id="password-display"
            type="password"
            className="input"
            value="••••••••••••"
            readOnly
            disabled
            autoComplete="off"
          />
          <p className="text-xs text-black/50 dark:text-white/40">
            For security, your actual password is never shown. Use the form below to change it.
          </p>
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter your current password and choose a new one.
          </p>
        </div>

        {demo ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            Password changes are disabled in demo mode.
          </p>
        ) : (
          <form action={changePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="label" htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="input"
              />
            </div>
            <div className="space-y-1">
              <label className="label" htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="input"
              />
              <p className="text-xs text-black/50">{MIN_PASSWORD_LENGTH}+ characters.</p>
            </div>
            <div className="space-y-1">
              <label className="label" htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="input"
              />
            </div>
            <button className="btn-primary" type="submit">
              Save password
            </button>
          </form>
        )}
      </section>

      <p className="text-sm text-black/50 dark:text-white/40">
        <Link href="/" className="underline">← Back to dashboard</Link>
      </p>
    </div>
  );
}
