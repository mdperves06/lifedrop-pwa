import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { NotificationList } from "./list";
import { PushToggle } from "@/components/client/push-toggle";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const { t } = await getDictionary();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true },
  });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">{t.notifications.title}</h1>
      <div className="mb-4">
        <PushToggle />
      </div>
      <NotificationList initial={items.map((i) => ({ ...i, readAt: i.readAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString() }))} hasMore={items.length === 30} />
    </div>
  );
}
