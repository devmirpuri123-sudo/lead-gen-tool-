import Link from "next/link";
import { AuthShell, Label, buttonClass, fieldClass } from "@/app/_AuthShell";
import { MIN_PASSWORD_LENGTH, requireUser } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/authActions";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { error, ok } = await searchParams;

  return (
    <AuthShell
      title={user.mustChangePassword ? "Choose your own password" : "Change your password"}
      intro={
        user.mustChangePassword
          ? "You are signed in with a starting password set by an administrator. Please replace it before going any further."
          : `Signed in as ${user.name} (${user.email}).`
      }
      error={error}
      ok={ok}
      footer={
        user.mustChangePassword ? null : (
          <Link href="/" className="hover:underline">
            ← Back to the dashboard
          </Link>
        )
      }
    >
      <form action={changeOwnPassword} className="space-y-4">
        <label className="block">
          <Label>Current password</Label>
          <input type="password" name="current" required autoComplete="current-password" className={fieldClass} />
        </label>
        <label className="block">
          <Label>New password</Label>
          <input
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</span>
        </label>
        <label className="block">
          <Label>Confirm new password</Label>
          <input
            type="password"
            name="confirm"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
        <button type="submit" className={buttonClass}>Save new password</button>
      </form>
    </AuthShell>
  );
}
