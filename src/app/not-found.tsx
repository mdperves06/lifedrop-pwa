import { getDictionary } from "@/i18n/server";
import { EmptyState, LinkButton } from "@/components/ui";

export default async function NotFound() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState title={t.errors.notFound} body={t.errors.notFoundBody} action={<LinkButton href="/">{t.errors.goHome}</LinkButton>} />
    </div>
  );
}
