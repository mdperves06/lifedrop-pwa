import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { getSettings } from "@/server/settings";
import { pushEnabled } from "@/server/notify/channels";
import { env } from "@/server/env";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SettingsForm } from "../forms";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t } = await getDictionary();
  const s = await getSettings();
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.settings} />
      <Card><SettingsForm initial={s} /></Card>
      <Card>
        <h2 className="mb-2 font-bold">Integrations</h2>
        <ul className="space-y-1 text-sm">
          <li>Web Push: {pushEnabled() ? <Badge tone="success">configured</Badge> : <Badge tone="warning">not configured</Badge>}</li>
          <li>Email (SMTP): {env.smtp.host ? <Badge tone="success">{env.smtp.host}</Badge> : <Badge tone="warning">console only</Badge>}</li>
          <li>SMS: <Badge tone={env.sms.provider === "console" ? "warning" : "success"}>{env.sms.provider}</Badge></li>
          <li>In-process scheduler: <Badge tone={env.runJobsInProcess ? "success" : "neutral"}>{env.runJobsInProcess ? "on" : "off (use /api/cron/run)"}</Badge></li>
        </ul>
      </Card>
    </div>
  );
}
