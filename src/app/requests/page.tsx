import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { getSettings } from "@/server/settings";
import { publicRequestBoard } from "@/server/services/request-views";
import { EmptyState, LinkButton, PageHeader, PlusIcon, PhoneIcon, buttonClass } from "@/components/ui";
import { RequestCard } from "@/components/blocks";
import { AutoRefresh } from "@/components/client/auto-refresh";

export const metadata: Metadata = { title: "Active blood requests", description: "Open blood requests in the city. Patient details are hidden for privacy." };

export default async function RequestsBoard() {
  const [{ t, locale }, settings, list] = await Promise.all([getDictionary(), getSettings(), publicRequestBoard(60)]);
  return (
    <div>
      <PageHeader
        title={t.request.boardTitle}
        subtitle={t.request.boardSubtitle}
        actions={
          <>
            <a href={`tel:${settings.hotlinePhone}`} className={buttonClass("outline", "md", "text-primary")}>
              <PhoneIcon className="size-4" /> {t.common.hotline}
            </a>
            <LinkButton href="/requests/new">
              <PlusIcon className="size-4" /> {t.nav.requestBlood}
            </LinkButton>
          </>
        }
      />
      <AutoRefresh seconds={30} label={t.request.autoRefresh} />
      {list.length === 0 ? (
        <EmptyState title={t.home.noEmergencies} action={<LinkButton href="/requests/new">{t.nav.requestBlood}</LinkButton>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <RequestCard key={r.id} r={r} t={t} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
