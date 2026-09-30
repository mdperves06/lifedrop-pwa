import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AnnouncementForm } from "../forms";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncements() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t, locale } = await getDictionary();
  const list = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { createdBy: { select: { name: true } } } });
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.announcements} />
      <Card><AnnouncementForm /></Card>
      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.id}>
            <Card>
              <p className="font-semibold">{a.title} <Badge className="ml-1">{a.audience}</Badge></p>
              <p className="text-sm">{a.message}</p>
              <p className="mt-1 text-xs text-muted">{a.createdBy.name} · {formatDateTime(a.createdAt, locale)} · {t.admin.sentTo.replace("{n}", String(a.recipients))}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
