import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { Collapsible, LocationForm, LocationToggle } from "../forms";

export const metadata = { title: "Locations" };

export default async function AdminLocations() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t } = await getDictionary();
  const all = await db.location.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }], include: { _count: { select: { users: true, bloodRequests: true } } } });
  const children = (id: string) => all.filter((l) => l.parentId === id);
  const divisions = all.filter((l) => l.type === "DIVISION");
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.locations} subtitle="Division → District → Area. Locations are deactivated, never deleted." />
      <Collapsible label={t.admin.locations}>
        <LocationForm parents={all.filter((l) => l.type !== "AREA").map((l) => ({ id: l.id, name: l.name, type: l.type }))} />
      </Collapsible>
      {divisions.map((d) => (
        <Card key={d.id}>
          <details open={d.name === "Dhaka"}>
            <summary className="flex cursor-pointer items-center justify-between font-semibold">
              <span>{d.name} <span className="font-normal text-muted">· {d.nameBn}</span> {!d.isActive && <Badge tone="danger">inactive</Badge>}</span>
              <LocationToggle id={d.id} active={d.isActive} />
            </summary>
            <ul className="mt-2 space-y-2 pl-3">
              {children(d.id).map((di) => (
                <li key={di.id}>
                  <p className="flex items-center justify-between text-sm font-semibold">
                    <span>{di.name} <span className="font-normal text-muted">· {di.nameBn}</span> {!di.isActive && <Badge tone="danger">inactive</Badge>}</span>
                    <LocationToggle id={di.id} active={di.isActive} />
                  </p>
                  <ul className="flex flex-wrap gap-1.5 pl-3 pt-1">
                    {children(di.id).map((a) => (
                      <li key={a.id}>
                        <Badge tone={a.isActive ? "neutral" : "danger"}>{a.name} · {a._count.users}👤 {a._count.bloodRequests}🩸</Badge>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ))}
    </div>
  );
}
