import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/ui";
import { EligibilityChecker } from "./checker";

export const metadata: Metadata = { title: "Blood donation eligibility checker", description: "Quick, general guidance on whether you can donate blood today." };

export default async function EligibilityPage() {
  const [{ t }, settings] = await Promise.all([getDictionary(), getSettings()]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.eligibility.title} subtitle={t.eligibility.subtitle} />
      <EligibilityChecker intervalDays={settings.donationIntervalDays} />
      <p className="mt-6 text-sm text-muted">{t.app.disclaimer}</p>
    </div>
  );
}
