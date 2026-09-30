"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { relativeTime } from "@/lib/time";
import { api } from "@/lib/api-client";
import { AlertIcon, BellIcon, Button, CalendarIcon, ChartIcon, CheckIcon, EmptyState, HeartIcon, XIcon, cx } from "@/components/ui";
import { useAction } from "@/components/client/use-action";

type N = { id: string; type: string; title: string; message: string; link: string | null; readAt: string | null; createdAt: string };

const ICONS: Record<string, typeof BellIcon> = {
  EMERGENCY_ALERT: AlertIcon,
  DONATION_REQUEST: HeartIcon,
  REQUEST_ACCEPTED: CheckIcon,
  REQUEST_DECLINED: XIcon,
  REQUEST_CANCELLED: XIcon,
  APPOINTMENT_REMINDER: CalendarIcon,
  APPOINTMENT_UPDATE: CalendarIcon,
  LOW_STOCK: ChartIcon,
};

export function NotificationList({ initial, hasMore }: { initial: N[]; hasMore: boolean }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const { run, pending } = useAction();

  const markRead = (ids: string[]) => {
    setItems((s) => s.map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    api("/api/notifications/read", { body: { ids } });
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const r = await api<{ items: N[]; nextCursor: string | null }>(`/api/notifications?cursor=${items.at(-1)?.id ?? ""}`);
    setLoadingMore(false);
    if (r.ok) {
      setItems((s) => [...s, ...r.data.items.map((i) => ({ ...i, readAt: i.readAt, createdAt: i.createdAt }))]);
      setMore(!!r.data.nextCursor);
    }
  };

  if (items.length === 0) return <EmptyState icon={<BellIcon className="size-10" />} title={t.notifications.empty} />;
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={() => run("/api/notifications/read", { body: { all: true }, onSuccess: () => setItems((s) => s.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))) })}
          >
            <CheckIcon className="size-4" /> {t.notifications.markAll}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? BellIcon;
          const emergency = n.type === "EMERGENCY_ALERT";
          const body = (
            <div className={cx("flex gap-3 p-4", !n.readAt && "bg-primary-soft/40")}>
              <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", emergency ? "bg-danger text-white" : "bg-surface-2 text-fg")}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("font-semibold", emergency && "text-danger")}>
                  {n.title}
                  {!n.readAt && <span className="ml-2 inline-block size-2 rounded-full bg-primary align-middle" aria-label={t.notifications.unread} />}
                </p>
                <p className="text-sm text-muted">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{relativeTime(n.createdAt, locale)}</p>
              </div>
            </div>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => !n.readAt && markRead([n.id])} className="block hover:bg-surface-2">
                  {body}
                </Link>
              ) : (
                <button className="block w-full text-left hover:bg-surface-2" onClick={() => !n.readAt && markRead([n.id])}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {more && (
        <div className="mt-4 text-center">
          <Button variant="outline" loading={loadingMore} onClick={loadMore}>{t.common.viewAll}</Button>
        </div>
      )}
    </div>
  );
}
