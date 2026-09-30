import { getDictionary } from "@/i18n/server";
import { EmptyState, LinkButton, ShieldIcon } from "@/components/ui";

export default async function Forbidden() {
  const { t } = await getDictionary();
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={<ShieldIcon className="size-10" />} title={t.errors.forbidden} action={<LinkButton href="/">{t.errors.goHome}</LinkButton>} />
    </div>
  );
}
