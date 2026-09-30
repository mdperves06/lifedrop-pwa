import { requirePageUser } from "@/server/auth/guard";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { allLocations } from "@/server/services/locations";
import { liveStatus, parseEquipment, parseGroups } from "@/server/services/centers";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CenterForm, Collapsible, EditCenter } from "../forms";

export const metadata = { title: "Centers" };

export default async function AdminCenters() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t } = await getDictionary();
  const [centers, locs] = await Promise.all([db.center.findMany({ orderBy: { name: "asc" }, include: { location: { select: { name: true } }, _count: { select: { staff: true, donations: true } } } }), allLocations()]);
  const locations = locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }));
  const statuses = await Promise.all(centers.map((c) => liveStatus(c)));
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.centers} />
      <Collapsible label={t.admin.centers}>
        <CenterForm locations={locations} />
      </Collapsible>
      <ul className="space-y-3">
        {centers.map((c, i) => (
          <li key={c.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    <Link href={`/centers/${c.id}`} className="hover:text-primary">{c.name}</Link>{" "}
                    <Badge tone={statuses[i] === "OPEN" ? "success" : statuses[i] === "FULL" ? "warning" : "neutral"}>{statuses[i]}</Badge>{" "}
                    {!c.isActive && <Badge tone="danger">inactive</Badge>}
                  </p>
                  <p className="text-sm text-muted">{c.address}, {c.location.name} · {c.openTime}–{c.closeTime} · {c.capacityPerSlot}/h · staff accounts {c._count.staff} · donations {c._count.donations}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/center?centerId=${c.id}`} className="text-sm font-semibold text-primary">{t.nav.centerPortal}</Link>
                </div>
              </div>
              <div className="mt-2">
                <EditCenter
                  locations={locations}
                  center={{
                    id: c.id, name: c.name, address: c.address, phone: c.phone, email: c.email ?? "", locationId: c.locationId, lat: String(c.lat), lng: String(c.lng), openTime: c.openTime, closeTime: c.closeTime,
                    openDays: c.openDays, capacityPerSlot: String(c.capacityPerSlot), staffCount: String(c.staffCount), beds: String(c.beds), equipment: parseEquipment(c.equipment).join(", "),
                    neededBloodGroups: parseGroups(c.neededBloodGroups), statusOverride: c.statusOverride, description: c.description ?? "", isActive: c.isActive,
                  }}
                />
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
