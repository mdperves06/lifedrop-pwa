"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button, StarIcon, cx } from "@/components/ui";
import { TextArea } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

export const CenterMap = dynamic(() => import("@/components/client/map").then((m) => m.CenterMapEmbed), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-surface-2" />,
});

export function ReviewForm({ centerId }: { centerId: string }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { run, pending } = useAction();
  return (
    <form
      className="space-y-3 rounded-xl bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(`/api/centers/${centerId}/reviews`, { body: { rating, comment: comment || undefined }, success: t.centers.reviewThanks, onSuccess: () => setComment("") });
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t.centers.writeReview}</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i}/5`} onClick={() => setRating(i)} className={cx("grid size-10 place-items-center rounded-lg", i <= rating ? "text-warning" : "text-muted")}>
              <StarIcon className="size-6" filled={i <= rating} />
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea label={t.common.note} name="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <Button type="submit" size="sm" loading={pending}>{t.centers.submitReview}</Button>
    </form>
  );
}

export function WalkInButton({ centerId }: { centerId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <Button
      variant="secondary"
      loading={pending}
      title={t.appointments.walkInHint}
      onClick={async () => {
        const ok = await run("/api/appointments", { body: { centerId, startsAt: new Date().toISOString(), walkIn: true }, success: t.appointments.booked, refresh: false });
        if (ok) router.push("/appointments");
      }}
    >
      {t.appointments.walkIn}
    </Button>
  );
}
