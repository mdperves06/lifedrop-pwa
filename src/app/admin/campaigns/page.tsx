import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { allLocations } from "@/server/services/locations";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CampaignForm, Collapsible, EditCampaign } from "../forms";

export const metadata = { title: "Campaigns" };

export default async function AdminCampaigns() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t, locale } = await getDictionary();
  const [campaigns, centers, locs] = await Promise.all([
    db.campaign.findMany({ orderBy: { startsAt: "desc" }, include: { location: { select: { name: true } }, center: { select: { name: true } }, _count: { select: { appointments: true } } } }),
    db.center.findMany({ select: { id: true, name: true } }),
    allLocations(),
  ]);
  const locations = locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }));
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.campaigns} />
      <Collapsible label={t.admin.campaigns}>
        <CampaignForm centers={centers} locations={locations} />
      </Collapsible>
      <ul className="space-y-3">
        {campaigns.map((c) => (
          <li key={c.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.title} <Badge className="ml-1" tone={c.status === "ACTIVE" ? "success" : c.status === "PLANNED" ? "info" : "neutral"}>{c.status}</Badge></p>
                  <p className="text-sm text-muted">{formatDateTime(c.startsAt, locale)} · {c.venue}, {c.location.name}{c.center ? ` · ${c.center.name}` : ""}</p>
                  <p className="text-sm">{t.campaigns.booked.replace("{n}", String(c._count.appointments))} / {t.campaigns.target.replace("{n}", String(c.targetDonors))}</p>
                </div>
                <EditCampaign
                  campaign={{ id: c.id, title: c.title, description: c.description, venue: c.venue, locationId: c.locationId, centerId: c.centerId, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString(), targetDonors: c.targetDonors, status: c.status }}
                  centers={centers}
                  locations={locations}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
