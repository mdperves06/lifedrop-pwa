"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n";
import {
  BellIcon, BookIcon, CalendarIcon, ChartIcon, DropIcon, HeartIcon, HomeIcon, HospitalIcon, MapPinIcon, MenuIcon, PlusIcon,
  SearchIcon, ShieldIcon, UserIcon, XIcon, AlertIcon, cx, buttonClass,
} from "@/components/ui";
import { api } from "@/lib/api-client";

export type ShellUser = { name: string; role: "DONOR" | "CENTER_STAFF" | "HOSPITAL" | "ADMIN"; avatar: string | null } | null;

const UnreadCtx = createContext(0);

/** Single poller for the unread badge, shared by the header and tab bar. */
export function UnreadProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const count = usePollUnread(enabled);
  return <UnreadCtx.Provider value={count}>{children}</UnreadCtx.Provider>;
}

function useUnreadCount() {
  return useContext(UnreadCtx);
}

function usePollUnread(enabled: boolean) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await api<{ unread: number }>("/api/notifications/unread");
      if (alive && r.ok) setCount(r.data.unread);
    };
    load();
    const id = setInterval(load, 20_000);
    const onMsg = (e: MessageEvent) => e.data?.type === "push-received" && load();
    navigator.serviceWorker?.addEventListener("message", onMsg);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled, pathname]);
  return count;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after hydration
      setTheme((localStorage.getItem("ld_theme") as "light" | "dark" | null) ?? "system");
    } catch {}
  }, []);
  const apply = (v: "light" | "dark" | "system") => {
    setTheme(v);
    try {
      if (v === "system") localStorage.removeItem("ld_theme");
      else localStorage.setItem("ld_theme", v);
    } catch {}
    const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#18181e" : "#c8102e");
  };
  return (
    <div className={cx("inline-flex rounded-xl bg-surface-2 p-1", className)} role="radiogroup" aria-label={t.common.theme}>
      {(["light", "dark", "system"] as const).map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={theme === v}
          onClick={() => apply(v)}
          className={cx("min-h-9 rounded-lg px-3 text-sm font-medium", theme === v ? "bg-surface shadow-card" : "text-muted")}
        >
          {t.common[v]}
        </button>
      ))}
    </div>
  );
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  // The server sets the locale cookie (and saves it on the profile for signed-in users).
  const set = async (l: Locale) => {
    await api("/api/me/locale", { method: "POST", body: { locale: l } });
    router.refresh();
  };
  return (
    <div className={cx("inline-flex rounded-xl bg-surface-2 p-1", className)} role="radiogroup" aria-label={t.common.language}>
      {(
        [
          ["en", "English"],
          ["bn", "বাংলা"],
        ] as const
      ).map(([l, label]) => (
        <button key={l} role="radio" aria-checked={locale === l} onClick={() => set(l)} lang={l} className={cx("min-h-9 rounded-lg px-3 text-sm font-medium", locale === l ? "bg-surface shadow-card" : "text-muted")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Logo() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight" aria-label={`${t.app.name} — ${t.nav.home}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
        <DropIcon className="size-5" />
      </span>
      <span className="text-lg">{t.app.name}</span>
    </Link>
  );
}

export function Header({ user, hotline }: { user: ShellUser; hotline: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on navigation
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const main = [
    { href: "/donors", label: t.nav.findDonors },
    { href: "/requests", label: t.nav.emergencies },
    { href: "/centers", label: t.nav.centers },
    { href: "/inventory", label: t.nav.inventory },
    { href: "/learn", label: t.nav.learn },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
          {t.nav.skipToContent}
        </a>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
            {main.map((m) => (
              <Link key={m.href} href={m.href} aria-current={pathname.startsWith(m.href) ? "page" : undefined} className={cx("rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface-2", pathname.startsWith(m.href) ? "text-primary" : "text-muted")}>
                {m.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <a href={`tel:${hotline}`} className={buttonClass("ghost", "sm", "text-primary max-sm:hidden")} aria-label={`${t.common.hotline} ${hotline}`}>
              <AlertIcon className="size-4" /> {hotline}
            </a>
            <Link href="/requests/new" className={buttonClass("primary", "sm", "max-md:hidden")}>
              <PlusIcon className="size-4" /> {t.nav.requestBlood}
            </Link>
            {user ? (
              <Link href="/notifications" className="relative grid size-11 place-items-center rounded-xl hover:bg-surface-2" aria-label={`${t.nav.notifications}${unread ? ` (${unread} ${t.notifications.unread})` : ""}`}>
                <BellIcon />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] font-bold leading-5 text-white">{unread > 99 ? "99+" : unread}</span>}
              </Link>
            ) : (
              <Link href="/login" className={buttonClass("outline", "sm", "max-sm:hidden")}>
                {t.nav.login}
              </Link>
            )}
            <button className="grid size-11 place-items-center rounded-xl hover:bg-surface-2" onClick={() => setOpen(true)} aria-label={t.nav.menu} aria-expanded={open} aria-controls="app-drawer">
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>
      <Drawer open={open} onClose={() => setOpen(false)} user={user} hotline={hotline} />
    </>
  );
}

function Drawer({ open, onClose, user, hotline }: { open: boolean; onClose: () => void; user: ShellUser; hotline: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const item = (href: string, label: string, Icon: typeof HomeIcon) => (
    <li key={href}>
      <Link href={href} aria-current={pathname === href ? "page" : undefined} className={cx("flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium hover:bg-surface-2", pathname === href && "bg-primary-soft text-primary")}>
        <Icon className="size-5 shrink-0" />
        {label}
      </Link>
    </li>
  );
  return (
    <div id="app-drawer" className={cx("fixed inset-0 z-50", open ? "" : "pointer-events-none")} aria-hidden={!open} inert={!open}>
      <div className={cx("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={t.nav.menu} className={cx("absolute right-0 top-0 flex h-full w-[min(22rem,88vw)] flex-col overflow-y-auto bg-surface p-4 shadow-2xl transition-transform", open ? "translate-x-0" : "translate-x-full")}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold">{user ? user.name : t.app.name}</span>
          <button onClick={onClose} className="grid size-11 place-items-center rounded-xl hover:bg-surface-2" aria-label={t.nav.close}>
            <XIcon />
          </button>
        </div>
        <nav aria-label={t.nav.menu}>
          <ul className="space-y-0.5">
            {item("/", t.nav.home, HomeIcon)}
            {item("/donors", t.nav.findDonors, SearchIcon)}
            {item("/requests/new", t.nav.requestBlood, PlusIcon)}
            {item("/requests", t.nav.emergencies, AlertIcon)}
            {item("/centers", t.nav.centers, MapPinIcon)}
            {item("/inventory", t.nav.inventory, ChartIcon)}
            {item("/campaigns", t.nav.campaigns, CalendarIcon)}
            {item("/learn", t.nav.learn, BookIcon)}
            {item("/eligibility", t.nav.eligibility, HeartIcon)}
          </ul>
          {user && (
            <>
              <hr className="my-3 border-border" />
              <ul className="space-y-0.5">
                {item("/dashboard", t.nav.dashboard, DropIcon)}
                {item("/my-requests", t.nav.myRequests, BookIcon)}
                {item("/incoming", t.nav.incoming, HeartIcon)}
                {item("/appointments", t.nav.appointments, CalendarIcon)}
                {item("/notifications", t.nav.notifications, BellIcon)}
                {item("/profile", t.nav.profile, UserIcon)}
                {user.role === "CENTER_STAFF" && item("/center", t.nav.centerPortal, MapPinIcon)}
                {user.role === "HOSPITAL" && item("/hospital", t.nav.hospitalPortal, HospitalIcon)}
                {user.role === "ADMIN" && item("/admin", t.nav.admin, ShieldIcon)}
                {user.role === "ADMIN" && item("/center", t.nav.centerPortal, MapPinIcon)}
              </ul>
            </>
          )}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          <a href={`tel:${hotline}`} className={buttonClass("outline", "md", "w-full text-primary")}>
            <AlertIcon className="size-4" /> {t.common.hotline}: {hotline}
          </a>
          <LanguageSwitch className="w-full justify-center" />
          <ThemeToggle className="w-full justify-center" />
          {user ? (
            <form action="/api/auth/logout" method="post">
              <button className={buttonClass("secondary", "md", "w-full")}>{t.nav.logout}</button>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/login" className={buttonClass("outline")}>{t.nav.login}</Link>
              <Link href="/register" className={buttonClass("primary")}>{t.nav.register}</Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function BottomTabs({ user }: { user: ShellUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const unread = useUnreadCount();
  const tabs = [
    { href: "/", label: t.nav.home, Icon: HomeIcon, match: (p: string) => p === "/" },
    { href: "/donors", label: t.nav.find, Icon: SearchIcon, match: (p: string) => p.startsWith("/donors") },
    { href: "/requests/new", label: t.nav.request, Icon: PlusIcon, match: (p: string) => p === "/requests/new", primary: true },
    { href: user ? "/notifications" : "/requests", label: user ? t.nav.alerts : t.nav.emergencies, Icon: user ? BellIcon : AlertIcon, match: (p: string) => p.startsWith(user ? "/notifications" : "/requests") && p !== "/requests/new", badge: unread },
    { href: user ? "/dashboard" : "/login", label: user ? t.nav.profile : t.nav.login, Icon: UserIcon, match: (p: string) => ["/dashboard", "/profile", "/login"].some((x) => p.startsWith(x)) },
  ];
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden" aria-label="Tabs">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map(({ href, label, Icon, match, primary, badge }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-primary" : "text-muted")}>
                {primary ? (
                  <span className="-mt-5 grid size-12 place-items-center rounded-full bg-primary text-white shadow-lg ring-4 ring-surface">
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <Icon className="size-6" />
                )}
                <span>{label}</span>
                {!!badge && <span className="absolute right-[22%] top-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-white">{badge > 9 ? "9+" : badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
