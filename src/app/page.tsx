import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n";
import { getSettings } from "@/server/settings";
import { publicImpact } from "@/server/services/stats";
import { stockByGroup } from "@/server/services/inventory";
import { publicRequestBoard } from "@/server/services/request-views";
import { AlertIcon, Card, CheckIcon, EmptyState, HeartIcon, LinkButton, SearchIcon, ShieldIcon, UserIcon, CalendarIcon, PhoneIcon } from "@/components/ui";
import { RequestCard, StockGrid } from "@/components/blocks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ t, locale }, settings, impact, stock, emergencies] = await Promise.all([
    getDictionary(),
    getSettings(),
    publicImpact(),
    stockByGroup(),
    publicRequestBoard(4, true),
  ]);
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Hero */}
      <section className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t.home.heroTitle}</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">{fmt(t.home.heroSubtitle, { city: settings.cityName })}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex">
            <LinkButton href="/donors" size="lg">
              <SearchIcon /> {t.home.findBlood}
            </LinkButton>
            <LinkButton href="/register" size="lg" variant="outline">
              <HeartIcon /> {t.home.donateBlood}
            </LinkButton>
            <LinkButton href="/appointments/new" size="lg" variant="secondary" className="col-span-2 sm:col-span-1">
              <CalendarIcon /> {t.home.bookAppointment}
            </LinkButton>
          </div>
        </div>
        {/* Emergency panel */}
        <Card className="border-danger/40 bg-danger-soft">
          <p className="flex items-center gap-2 text-lg font-bold text-danger">
            <AlertIcon /> {t.home.urgentTitle}
          </p>
          <p className="mt-1 text-fg/85">{t.home.urgentBody}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <LinkButton href="/requests/new?priority=EMERGENCY" variant="danger" size="lg" className="flex-1">
              {t.home.createEmergency}
            </LinkButton>
            <a href={`tel:${settings.hotlinePhone}`} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-4 font-semibold text-danger">
              <PhoneIcon className="size-4" /> {settings.hotlinePhone}
            </a>
          </div>
        </Card>
      </section>

      {/* Impact counter */}
      <section aria-labelledby="impact-h">
        <h2 id="impact-h" className="mb-4 text-xl font-bold">{t.home.impactTitle}</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [n(impact.livesSaved), t.home.livesSaved],
            [n(impact.donors), t.home.registeredDonors],
            [n(impact.donations), t.home.donations],
            [n(impact.fulfilled), t.home.requestsFulfilled],
          ].map(([v, l]) => (
            <Card key={l} className="flex flex-col-reverse text-center">
              <dt className="text-sm text-muted">{l}</dt>
              <dd className="text-3xl font-extrabold tabular-nums text-primary">{v}</dd>
            </Card>
          ))}
        </dl>
      </section>

      {/* Active emergencies */}
      <section aria-labelledby="em-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="em-h" className="text-xl font-bold">{t.home.recentEmergencies}</h2>
          <Link href="/requests" className="text-sm font-semibold text-primary">{t.common.viewAll}</Link>
        </div>
        {emergencies.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {emergencies.map((r) => (
              <RequestCard key={r.id} r={r} t={t} locale={locale} />
            ))}
          </div>
        ) : (
          <EmptyState title={t.home.noEmergencies} />
        )}
      </section>

      {/* Stock */}
      <section aria-labelledby="stock-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="stock-h" className="text-xl font-bold">{t.home.stockTitle}</h2>
          <Link href="/inventory" className="text-sm font-semibold text-primary">{t.common.viewAll}</Link>
        </div>
        <StockGrid levels={stock} t={t} locale={locale} />
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h">
        <h2 id="how-h" className="mb-4 text-xl font-bold">{t.home.howTitle}</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            [UserIcon, t.home.how1Title, t.home.how1Body],
            [SearchIcon, t.home.how2Title, t.home.how2Body],
            [CheckIcon, t.home.how3Title, t.home.how3Body],
          ].map(([Icon, title, body], i) => {
            const I = Icon as typeof UserIcon;
            return (
              <li key={i}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary"><I /></span>
                    <span className="text-sm font-bold text-muted">{i + 1}</span>
                  </div>
                  <p className="mt-3 font-semibold">{title as string}</p>
                  <p className="mt-1 text-sm text-muted">{body as string}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Become a donor + safety */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="bg-primary text-white">
          <p className="text-xl font-bold">{t.home.becomeTitle}</p>
          <p className="mt-2 text-white/90">{t.home.becomeBody}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-semibold text-primary">{t.home.becomeCta}</Link>
            <Link href="/eligibility" className="inline-flex min-h-11 items-center rounded-xl border border-white/50 px-4 font-semibold">{t.home.checkEligibility}</Link>
          </div>
        </Card>
        <Card>
          <p className="flex items-center gap-2 text-xl font-bold"><ShieldIcon className="text-primary" /> {t.home.safetyTitle}</p>
          <p className="mt-2 text-muted">{t.home.safetyBody}</p>
          <Link href="/learn" className="mt-4 inline-block font-semibold text-primary">{t.home.learnMore} →</Link>
        </Card>
      </section>
    </div>
  );
}
