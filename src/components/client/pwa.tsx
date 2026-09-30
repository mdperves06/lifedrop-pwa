"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button, DropIcon, XIcon } from "@/components/ui";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const DISMISS_KEY = "ld_install_dismissed_at";
const SNOOZE_DAYS = 30;

function dismissedRecently() {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - v < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Registers the service worker and shows a single, snoozable install banner. */
export function PwaManager() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) setUpdate(reg);
          });
        });
      }).catch((e) => console.warn("SW registration failed", e));
    } else if ("serviceWorker" in navigator && process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "true") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone || dismissedRecently()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      // Wait a little so the banner doesn't compete with first paint / emergency actions.
      setTimeout(() => setDeferred(e as BIPEvent), 8000);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) iosTimer = setTimeout(() => setShowIos(true), 12000);
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDeferred(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome !== "accepted") dismiss();
    setDeferred(null);
  };

  return (
    <>
      {(deferred || showIos) && (
        <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-border bg-surface p-4 shadow-2xl md:bottom-6" role="dialog" aria-label={t.pwa.installTitle}>
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <DropIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.pwa.installTitle}</p>
              <p className="text-sm text-muted">{showIos && !deferred ? t.pwa.iosHint : t.pwa.installBody}</p>
              <div className="mt-3 flex gap-2">
                {deferred && (
                  <Button size="sm" onClick={install}>
                    {t.pwa.install}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  {t.pwa.notNow}
                </Button>
              </div>
            </div>
            <button onClick={dismiss} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2" aria-label={t.nav.close}>
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
      {update && (
        <div className="fixed inset-x-3 top-20 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-fg px-4 py-3 text-sm text-bg shadow-xl" role="status">
          {t.pwa.updateAvailable}
          <button
            className="font-semibold underline"
            onClick={() => {
              update.waiting?.postMessage({ type: "SKIP_WAITING" });
              setTimeout(() => location.reload(), 300);
            }}
          >
            {t.pwa.reload}
          </button>
        </div>
      )}
    </>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState = "unsupported" | "unconfigured" | "denied" | "off" | "on" | "loading";

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unconfigured";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) {
    await sub.unsubscribe();
    return "off";
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  }
  return "off";
}
