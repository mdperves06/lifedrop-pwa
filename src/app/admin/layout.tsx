import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · LifeDrop" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("ADMIN");
  const { t } = await getDictionary();
  const items: [string, string][] = [
    ["/admin", t.admin.overview],
    ["/admin/analytics", t.admin.analytics],
    ["/admin/users", t.admin.users],
    ["/admin/requests", t.admin.requests],
    ["/admin/reports", t.admin.reports],
    ["/admin/inventory", t.admin.inventory],
    ["/admin/appointments", t.admin.appointments],
    ["/admin/campaigns", t.admin.campaigns],
    ["/admin/centers", t.admin.centers],
    ["/admin/locations", t.admin.locations],
    ["/admin/announcements", t.admin.announcements],
    ["/admin/audit", t.admin.audit],
    ["/admin/settings", t.admin.settings],
  ];
  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-6">
      <AdminNav items={items} title={t.admin.title} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
