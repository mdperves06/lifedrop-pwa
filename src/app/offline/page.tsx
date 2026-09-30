import { getDictionary } from "@/i18n/server";
import { EmptyState, LinkButton } from "@/components/ui";


export default async function OfflinePage() {
  const { t } = await getDictionary().catch(() => ({ t: null }));
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        title={t?.pwa.offlineTitle ?? "You're offline"}
        body={t?.pwa.offlineBody ?? "Reconnect to search donors or post requests."}
        action={<LinkButton href="/">{t?.errors.goHome ?? "Home"}</LinkButton>}
      />
    </div>
  );
}
