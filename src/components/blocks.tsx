// Server-renderable presentational blocks shared across pages.
import Link from "next/link";
import type { Dictionary, Locale } from "@/i18n";
import { fmt, formatNumber } from "@/i18n";
import { BLOOD_GROUPS, BLOOD_LABEL, CAN_DONATE_TO, compatibleDonorGroups, type BloodGroupCode } from "@/lib/blood";
import { formatDateTime, relativeTime } from "@/lib/time";
import { STEPPER, isTerminal } from "@/lib/lifecycle";
import { AlertIcon, Badge, BloodBadge, Card, ClockIcon, HospitalIcon, MapPinIcon, cx, priorityTone, requestStatusTone, stockTone } from "@/components/ui";

export function StockGrid({ levels, t, locale }: { levels: { bloodGroup: string; units: number; level: string; expiringSoon: number }[]; t: Dictionary; locale: Locale }) {
  return (
    <ul className="grid grid-cols-4 gap-2 sm:gap-3">
      {levels.map((l) => (
        <li
          key={l.bloodGroup}
          className={cx(
            "rounded-2xl border p-3 text-center",
            l.level === "CRITICAL" ? "border-danger/40 bg-danger-soft" : l.level === "LOW" ? "border-warning/40 bg-warning-soft" : "border-success/30 bg-success-soft",
          )}
        >
          <p className="text-xl font-extrabold">{BLOOD_LABEL[l.bloodGroup as BloodGroupCode]}</p>
          <p className="text-2xl font-bold tabular-nums">{formatNumber(l.units, locale)}</p>
          <p className="text-[11px] text-muted">{t.common.units}</p>
          <span className={cx("mt-1 inline-flex items-center gap-1 text-xs font-semibold", l.level === "CRITICAL" ? "text-danger" : l.level === "LOW" ? "text-warning" : "text-success")}>
            <span aria-hidden="true" className={cx("size-2 rounded-full", l.level === "CRITICAL" ? "bg-danger" : l.level === "LOW" ? "bg-warning" : "bg-success")} />
            {t.blood.stock[l.level as keyof typeof t.blood.stock]}
          </span>
          {l.expiringSoon > 0 && <p className="mt-1 text-[10px] text-muted">{fmt(t.blood.expiringSoon, { n: l.expiringSoon })}</p>}
        </li>
      ))}
    </ul>
  );
}

export type BoardRequest = { id: string; bloodGroup: string; units: number; unitsFulfilled: number; hospitalName: string; area: string; areaBn: string; neededAt: Date; priority: string; status: string; createdAt: Date };

export function RequestCard({ r, t, locale, href }: { r: BoardRequest; t: Dictionary; locale: Locale; href?: string }) {
  const emergency = r.priority === "EMERGENCY";
  return (
    <Link href={href ?? `/requests/${r.id}`} className="block focus-visible:outline-none">
      <Card className={cx("h-full transition-shadow hover:shadow-md", emergency && "border-danger/50 ring-1 ring-danger/20")}>
        {emergency && (
          <p className="-mx-4 -mt-4 mb-3 flex items-center gap-2 rounded-t-2xl bg-danger px-4 py-1.5 text-xs font-bold tracking-wide text-white sm:-mx-5 sm:-mt-5">
            <AlertIcon className="size-4" /> {t.request.emergencyBanner}
          </p>
        )}
        <div className="flex items-start gap-3">
          <BloodBadge group={r.bloodGroup} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={priorityTone[r.priority]}>{t.priority[r.priority as keyof typeof t.priority]}</Badge>
              <Badge tone={requestStatusTone[r.status]}>{t.requestStatus[r.status as keyof typeof t.requestStatus]}</Badge>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
              <HospitalIcon className="size-4 shrink-0 text-muted" />
              <span className="truncate">{r.hospitalName}</span>
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <MapPinIcon className="size-4 shrink-0" /> {locale === "bn" ? r.areaBn || r.area : r.area}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <ClockIcon className="size-4 shrink-0" /> {t.request.neededBy}: {formatDateTime(r.neededAt, locale)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums">{formatNumber(r.units, locale)}</p>
            <p className="text-xs text-muted">{t.common.units}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{relativeTime(r.createdAt, locale)}</p>
      </Card>
    </Link>
  );
}

export function CompatibilityChart({ t, highlight }: { t: Dictionary; highlight?: BloodGroupCode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-sm">
        <caption className="mb-2 text-left text-sm text-muted">{t.blood.compatibilityNote}</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-left text-xs font-semibold text-muted">
              {t.blood.donor} ↓ / {t.blood.recipient} →
            </th>
            {BLOOD_GROUPS.map((r) => (
              <th key={r} scope="col" className="p-2 font-bold">{BLOOD_LABEL[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BLOOD_GROUPS.map((d) => (
            <tr key={d}>
              <th scope="row" className={cx("rounded-lg p-2 text-left font-bold", highlight === d && "bg-primary-soft text-primary")}>{BLOOD_LABEL[d]}</th>
              {BLOOD_GROUPS.map((r) => {
                const okk = CAN_DONATE_TO[d].includes(r);
                return (
                  <td key={r} className={cx("rounded-lg p-2", okk ? "bg-success-soft text-success" : "bg-surface-2 text-muted/60")}>
                    <span aria-hidden="true">{okk ? "✓" : "–"}</span>
                    <span className="sr-only">{okk ? `${BLOOD_LABEL[d]} → ${BLOOD_LABEL[r]}: yes` : `${BLOOD_LABEL[d]} → ${BLOOD_LABEL[r]}: no`}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompatibilityCards({ t }: { t: Dictionary }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BLOOD_GROUPS.map((g) => (
        <li key={g}>
          <Card className="h-full">
            <div className="flex items-center gap-3">
              <BloodBadge group={g} size="sm" />
              <p className="text-sm font-semibold">{g === "O_NEG" ? t.blood.universalDonor : g === "AB_POS" ? t.blood.universalRecipient : ""}</p>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.blood.canGiveTo}</p>
            <p className="text-sm">{CAN_DONATE_TO[g].map((x) => BLOOD_LABEL[x]).join(", ")}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.blood.canReceiveFrom}</p>
            <p className="text-sm">{compatibleDonorGroups(g).map((x) => BLOOD_LABEL[x]).join(", ")}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function StatusStepper({ status, t }: { status: string; t: Dictionary }) {
  const idx = STEPPER.indexOf(status as (typeof STEPPER)[number]);
  if (isTerminal(status) && status !== "CLOSED") {
    return <Badge tone="neutral" className="text-sm">{t.requestStatus[status as keyof typeof t.requestStatus]}</Badge>;
  }
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label={t.common.status}>
      {STEPPER.map((s, i) => (
        <li key={s} className="flex items-center gap-1" aria-current={i === idx ? "step" : undefined}>
          <span className={cx("grid size-6 place-items-center rounded-full text-[11px] font-bold", i < idx ? "bg-success text-white" : i === idx ? "bg-primary text-white" : "bg-surface-2 text-muted")}>{i < idx ? "✓" : i + 1}</span>
          <span className={cx("font-medium", i === idx ? "text-fg" : "text-muted")}>{t.requestStatus[s]}</span>
          {i < STEPPER.length - 1 && <span className="mx-1 h-px w-3 bg-border" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

/** Minimal dependency-free SVG bar/line chart. */
export function BarChart({ data, height = 160, label, target, color = "var(--primary)", formatLabel }: { data: { label: string; value: number }[]; height?: number; label: string; target?: number; color?: string; formatLabel?: (s: string) => string }) {
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={label}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 16);
          return (
            <g key={d.label}>
              <rect x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={Math.max(h, 0.5)} rx="1" fill={color} opacity={0.85}>
                <title>{`${formatLabel ? formatLabel(d.label) : d.label}: ${d.value}`}</title>
              </rect>
            </g>
          );
        })}
        {target != null && <line x1="0" x2="100" y1={height - (target / max) * (height - 16)} y2={height - (target / max) * (height - 16)} stroke="var(--muted)" strokeDasharray="2 2" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{formatLabel ? formatLabel(data[0]?.label ?? "") : data[0]?.label}</span>
        <span>{formatLabel ? formatLabel(data.at(-1)?.label ?? "") : data.at(-1)?.label}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th>{d.label}</th><td>{d.value}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function LineChart({ data, label, height = 160 }: { data: { label: string; value: number }[]; label: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = Math.max(1, max - min);
  const pts = data.map((d, i) => `${(i / Math.max(1, data.length - 1)) * 100},${height - 8 - ((d.value - min) / span) * (height - 24)}`);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={label}>
        <polyline points={`0,${height} ${pts.join(" ")} 100,${height}`} fill="var(--primary-soft)" stroke="none" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{data[0]?.label}</span>
        <span>
          {max} max · {data.at(-1)?.value} now
        </span>
        <span>{data.at(-1)?.label}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th>{d.label}</th><td>{d.value}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBarList({ items, locale }: { items: { label: string; value: number; tone?: string }[]; locale: Locale }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="font-semibold">{i.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted">{formatNumber(i.value, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

export { stockTone };
