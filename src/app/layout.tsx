import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDictionary } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { Header, BottomTabs, UnreadProvider, type ShellUser } from "@/components/client/shell";
import { ToastProvider } from "@/components/client/toast";
import { PwaManager } from "@/components/client/pwa";
import { SiteFooter } from "@/components/footer";

const base = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "LifeDrop — Find blood donors & donate blood", template: "%s · LifeDrop" },
  description: "LifeDrop connects voluntary blood donors, donation centers and hospitals. Find compatible donors, book a donation, and post emergency blood requests.",
  applicationName: "LifeDrop",
  appleWebApp: { capable: true, title: "LifeDrop", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: "LifeDrop",
    title: "LifeDrop — Blood donation, coordinated",
    description: "Find compatible blood donors quickly, book donations and respond to emergencies.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "LifeDrop" }],
  },
  twitter: { card: "summary", title: "LifeDrop", description: "Find blood donors when it matters most." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c8102e" },
    { media: "(prefers-color-scheme: dark)", color: "#18181e" },
  ],
};

// Applied before paint to avoid a light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('ld_theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, user, settings] = await Promise.all([getDictionary(), getSessionUser(), getSettings()]);
  const shellUser: ShellUser = user ? { name: user.name, role: user.role, avatar: user.avatarPath } : null;
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale} t={t}>
          <ToastProvider>
            <UnreadProvider enabled={!!user}>
              <Header user={shellUser} hotline={settings.hotlinePhone} />
              <main id="main" className="mx-auto min-h-[60vh] w-full max-w-6xl px-4 pb-10 pt-5 sm:pt-8">
                {children}
              </main>
              <SiteFooter />
              <BottomTabs user={shellUser} />
            </UnreadProvider>
            <PwaManager />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
