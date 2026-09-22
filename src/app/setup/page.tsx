import { redirect } from "next/navigation";
import { AuthShell, Label, buttonClass, fieldClass } from "@/app/_AuthShell";
import { MIN_PASSWORD_LENGTH, needsFirstAdmin, setupTokenRequired } from "@/lib/auth";
import { completeSetup } from "@/lib/authActions";

export const dynamic = "force-dynamic";

/**
 * Shown only while the database has no accounts at all. The first person to
 * reach it becomes the administrator, so open the site and complete this
 * immediately after deploying.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!needsFirstAdmin()) redirect("/login");
  const { error } = await searchParams;
  const tokenRequired = setupTokenRequired();

  return (
    <AuthShell
      title="Create the first account"
      intro={
        tokenRequired ? (
          <>
            No accounts exist yet. Enter the setup code from your hosting settings to create the first
            administrator. Once you do, the site is locked and only people you invite can get in.
          </>
        ) : (
          <>
            No accounts exist yet, so this page is open to anyone who finds the address.{" "}
            <strong>Complete it now</strong> — once you do, the site is locked and only people you invite can get in.
          </>
        )
      }
      error={error}
    >
      <form action={completeSetup} className="space-y-4">
        {tokenRequired && (
          <label className="block">
            <Label>Setup code</Label>
            <input type="password" name="setup_token" required autoComplete="off" className={fieldClass} />
            <span className="mt-1 block text-xs text-slate-500">
              The SETUP_TOKEN value you set in the hosting settings. Needed once, for this page only.
            </span>
          </label>
        )}
        <label className="block">
          <Label>Your full name</Label>
          <input type="text" name="name" required maxLength={80} className={fieldClass} />
          <span className="mt-1 block text-xs text-slate-500">
            Recorded against every score, note and approval you enter.
          </span>
        </label>
        <label className="block">
          <Label>Your email address</Label>
          <input type="email" name="email" required autoComplete="username" className={fieldClass} />
        </label>
        <label className="block">
          <Label>Choose a password</Label>
          <input
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will remember is better than a
            short complicated word.
          </span>
        </label>
        <label className="block">
          <Label>Confirm password</Label>
          <input
            type="password"
            name="confirm"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
        <button type="submit" className={buttonClass}>Create account and sign in</button>
      </form>
    </AuthShell>
  );
}
