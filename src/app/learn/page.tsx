import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { getSettings } from "@/server/settings";
import { Card, CheckIcon, LinkButton, PageHeader, XIcon } from "@/components/ui";
import { CompatibilityCards, CompatibilityChart } from "@/components/blocks";

export const metadata: Metadata = {
  title: "Learn about blood donation",
  description: "Blood donation facts, myths, benefits, the blood type compatibility chart, the donation process and FAQs.",
};

export default async function LearnPage() {
  const [{ t }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const nav = [
    ["facts", t.learn.factsTitle],
    ["myths", t.learn.mythsTitle],
    ["benefits", t.learn.benefitsTitle],
    ["compatibility", t.blood.compatibilityTitle],
    ["steps", t.learn.stepsTitle],
    ["faq", t.learn.faqTitle],
  ];
  return (
    <div className="space-y-10">
      <PageHeader title={t.learn.title} actions={<LinkButton href="/eligibility" variant="outline">{t.home.checkEligibility}</LinkButton>} />
      <nav aria-label={t.learn.title} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {nav.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-surface-2 px-4 text-sm font-medium hover:bg-border">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="facts" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">{t.learn.factsTitle}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {t.learn.facts.map((f) => (
            <li key={f}><Card className="h-full">{f}</Card></li>
          ))}
        </ul>
      </section>

      <section id="myths" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">{t.learn.mythsTitle}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {t.learn.myths.map(([myth, fact]) => (
            <li key={myth}>
              <Card className="h-full">
                <p className="flex items-start gap-2 font-semibold text-danger"><XIcon className="mt-0.5 size-4 shrink-0" /> {myth}</p>
                <p className="mt-2 flex items-start gap-2 text-fg"><CheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> {fact}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section id="benefits" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">{t.learn.benefitsTitle}</h2>
        <Card>
          <ul className="space-y-2">
            {t.learn.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-5 shrink-0 text-success" /> {b}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section id="compatibility" className="scroll-mt-24 space-y-4">
        <h2 className="text-xl font-bold">{t.blood.compatibilityTitle}</h2>
        <Card><CompatibilityChart t={t} /></Card>
        <CompatibilityCards t={t} />
      </section>

      <section id="steps" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">{t.learn.stepsTitle}</h2>
        <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {t.learn.steps.map(([title, body], i) => (
            <li key={title}>
              <Card className="flex h-full gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted">{body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="mb-4 text-xl font-bold">{t.learn.faqTitle}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {t.learn.faq.map(([q, a]) => (
            <details key={q} className="group p-4">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {q}
                <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-muted">{fmt(a, { days: settings.donationIntervalDays, km: settings.emergencyRadiusKm })}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">{t.app.disclaimer}</p>
    </div>
  );
}
