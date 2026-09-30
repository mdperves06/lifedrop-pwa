import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { ShieldIcon } from "@/components/ui";

export async function SiteFooter() {
  const { t } = await getDictionary();
  return (
    <footer className="mb-20 border-t border-border bg-surface md:mb-0">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-semibold text-fg">
            <ShieldIcon className="size-4 text-primary" /> {t.app.name}
          </p>
          <p className="mt-2 max-w-prose leading-relaxed">{t.app.disclaimer}</p>
        </div>
        <ul className="space-y-2">
          <li><Link className="hover:text-fg" href="/learn">{t.nav.learn}</Link></li>
          <li><Link className="hover:text-fg" href="/eligibility">{t.nav.eligibility}</Link></li>
          <li><Link className="hover:text-fg" href="/learn#faq">FAQ</Link></li>
        </ul>
        <ul className="space-y-2">
          <li><Link className="hover:text-fg" href="/centers">{t.nav.centers}</Link></li>
          <li><Link className="hover:text-fg" href="/campaigns">{t.nav.campaigns}</Link></li>
          <li><Link className="hover:text-fg" href="/inventory">{t.nav.inventory}</Link></li>
        </ul>
      </div>
    </footer>
  );
}
