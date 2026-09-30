import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { Card } from "@/components/ui";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ t }, user, sp] = await Promise.all([getDictionary(), getSessionUser(), searchParams]);
  const next = safeNextPath(sp.next);
  if (user) redirect(next ?? "/dashboard");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mb-5 mt-1 text-muted">{t.auth.loginSubtitle}</p>
      <Card>
        <LoginForm next={next} showDemo={!env.isProd} />
      </Card>
    </div>
  );
}
