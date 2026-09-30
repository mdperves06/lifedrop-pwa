"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-fetches server components on an interval while the tab is visible (lightweight "real-time"). */
export function AutoRefresh({ seconds = 15, label }: { seconds?: number; label?: string }) {
  const router = useRouter();
  const [at, setAt] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
        setAt(new Date());
      }
    };
    const id = setInterval(tick, seconds * 1000);
    const onMsg = (e: MessageEvent) => e.data?.type === "push-received" && tick();
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      clearInterval(id);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, [router, seconds]);
  if (!label) return null;
  return (
    <p className="mb-3 flex items-center gap-2 text-xs text-muted" aria-live="off">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {label}
      {at && <span suppressHydrationWarning> · {at.toLocaleTimeString()}</span>}
    </p>
  );
}
