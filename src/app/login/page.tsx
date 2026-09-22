import { redirect } from "next/navigation";
import { AuthShell, Label, buttonClass, fieldClass } from "@/app/_AuthShell";
import { getCurrentUser, needsFirstAdmin } from "@/lib/auth";
import { signIn } from "@/lib/authActions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (needsFirstAdmin()) redirect("/setup");
  if (await getCurrentUser()) redirect("/");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      intro="This tool holds named contacts' work details. Access is per person — please do not share your password."
      error={error}
      footer="Forgotten your password? Ask an administrator on your team to reset it for you."
    >
      <form action={signIn} className="space-y-4">
        <label className="block">
          <Label>Email address</Label>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            autoFocus
            className={fieldClass}
          />
        </label>
        <label className="block">
          <Label>Password</Label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={fieldClass}
          />
        </label>
        <button type="submit" className={buttonClass}>Sign in</button>
      </form>
    </AuthShell>
  );
}
