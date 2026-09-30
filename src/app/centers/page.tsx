import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { getSettings } from "@/server/settings";
import { listCenters } from "@/server/services/centers";
import { PageHeader } from "@/components/ui";
import { CentersExplorer } from "./explorer";

export const metadata: Metadata = { title: "Blood donation centers", description: "Find the nearest blood donation center, opening hours and live status." };
export const dynamic = "force-dynamic";

export default async function CentersPage() {
  const [{ t }, settings, centers] = await Promise.all([getDictionary(), getSettings(), listCenters()]);
  return (
    <div>
      <PageHeader title={t.centers.title} subtitle={fmt(t.centers.subtitle, { city: settings.cityName })} />
      <CentersExplorer centers={centers} />
    </div>
  );
}
