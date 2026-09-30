import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n/server";
import { getSessionUser } from "@/server/auth/session";
import { allLocations } from "@/server/services/locations";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Become a blood donor", description: "Register as a voluntary blood donor in two minutes." };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ t }, user, locs, sp] = await Promise.all([getDictionary(), getSessionUser(), allLocations(), searchParams]);
  if (user) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.auth.registerTitle}</h1>
      <p className="mb-5 mt-1 text-muted">{t.auth.registerSubtitle}</p>
      <RegisterForm locations={locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }))} referralCode={sp.ref?.slice(0, 20)} />
    </div>
  );
}
