import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n";
import { getSessionUser } from "@/server/auth/session";
import { requestDetail } from "@/server/services/request-views";
import { db } from "@/server/db";
import { bloodLabel } from "@/lib/blood";
import { formatDateTime, relativeTime } from "@/lib/time";
import { isActive } from "@/lib/lifecycle";
import { Alert, AlertIcon, Badge, BloodBadge, Card, ClockIcon, HospitalIcon, LinkButton, MapPinIcon, PhoneIcon, cx, priorityTone, requestStatusTone } from "@/components/ui";
import { StatusStepper } from "@/components/blocks";
import { AutoRefresh } from "@/components/client/auto-refresh";
import { RequestActions, MatchList, RespondButtons, IssueStock } from "./client";
import { ReportButton } from "@/components/client/report";

export const metadata: Metadata = { title: "Blood request", robots: { index: false } };

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, locale }, viewer] = await Promise.all([getDictionary(), getSessionUser()]);
  const r = await requestDetail(id, viewer);
  if (!r) notFound();
  const emergency = r.priority === "EMERGENCY";
  const active = isActive(r.status);
  const centers = r.isStaff && active ? await db.center.findMany({ where: { isActive: true, ...(viewer?.role === "CENTER_STAFF" ? { id: viewer.centerId ?? "" } : {}) }, select: { id: true, name: true } }) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {active && <AutoRefresh seconds={15} label={t.request.autoRefresh} />}
      <Card className={cx(emergency && "border-danger/50 ring-1 ring-danger/20")}>
        {emergency && (
          <p className="-mx-4 -mt-4 mb-4 flex items-center gap-2 rounded-t-2xl bg-danger px-4 py-2 text-sm font-bold tracking-wide text-white sm:-mx-5 sm:-mt-5">
            <AlertIcon className="size-4" /> {t.request.emergencyBanner}
          </p>
        )}
        <div className="flex items-start gap-4">
          <BloodBadge group={r.bloodGroup} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold sm:text-2xl">
              {bloodLabel(r.bloodGroup)} · {fmt(t.request.unitsProgress, { done: formatNumber(r.unitsFulfilled, locale), total: formatNumber(r.units, locale) })}
            </h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={priorityTone[r.priority]}>{t.priority[r.priority as keyof typeof t.priority]}</Badge>
              <Badge tone={requestStatusTone[r.status]}>{t.requestStatus[r.status as keyof typeof t.requestStatus]}</Badge>
              {r.requesterVerified ? <Badge tone="success">{t.common.verified}</Badge> : <Badge>{t.common.unverified}</Badge>}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex gap-2"><HospitalIcon className="size-5 shrink-0 text-muted" /><div><dt className="text-muted">{t.request.hospital}</dt><dd className="font-semibold">{r.hospitalName}</dd>{r.private?.hospitalAddress && <dd>{r.private.hospitalAddress}</dd>}</div></div>
          <div className="flex gap-2"><MapPinIcon className="size-5 shrink-0 text-muted" /><div><dt className="text-muted">{t.common.area}</dt><dd className="font-semibold">{locale === "bn" ? r.areaBn : r.area}</dd></div></div>
          <div className="flex gap-2"><ClockIcon className="size-5 shrink-0 text-muted" /><div><dt className="text-muted">{t.request.neededBy}</dt><dd className="font-semibold">{formatDateTime(r.neededAt, locale)}</dd><dd className="text-muted">{relativeTime(r.neededAt, locale)}</dd></div></div>
          {r.private && (
            <div className="flex gap-2"><PhoneIcon className="size-5 shrink-0 text-muted" /><div><dt className="text-muted">{t.request.requester}</dt><dd className="font-semibold">{r.private.requesterName} · {r.private.patientName}</dd>{r.private.contactPhone && <dd><a className="font-semibold text-primary" href={`tel:${r.private.contactPhone}`}>{r.private.contactPhone}</a></dd>}{r.private.hospitalPhone && <dd><a className="text-primary" href={`tel:${r.private.hospitalPhone}`}>{r.private.hospitalPhone}</a></dd>}</div></div>
          )}
        </dl>
        {r.private?.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{r.private.notes}</p>}
        {r.matchRadiusKm != null && r.priority !== "NORMAL" && <p className="mt-3 text-xs text-muted">{fmt(t.request.radiusNote, { km: r.matchRadiusKm })}</p>}
        {r.matchRadiusKm == null && r.priority !== "NORMAL" && r.counts.contacted > 0 && <p className="mt-3 text-xs text-muted">{t.request.radiusExpanded}</p>}
        <div className="mt-4">
          <StatusStepper status={r.status} t={t} />
        </div>
        {r.isManager && (
          <div className="mt-5 border-t border-border pt-4">
            <RequestActions id={r.id} status={r.status} units={r.units} />
          </div>
        )}
      </Card>

      {/* Donor who was asked */}
      {r.myInvite && (
        <Card>
          <h2 className="mb-2 font-bold">{t.incoming.respond}</h2>
          {r.myInvite.status === "PENDING" && active ? (
            <RespondButtons id={r.myInvite.id} />
          ) : (
            <Alert tone={r.myInvite.status === "ACCEPTED" || r.myInvite.status === "DONATED" ? "success" : "neutral"}>{t.donationRequestStatus[r.myInvite.status as keyof typeof t.donationRequestStatus]}</Alert>
          )}
          {(r.myInvite.status === "ACCEPTED") && <p className="mt-3 text-sm text-muted">{t.incoming.beforeYouGo}</p>}
        </Card>
      )}

      {/* Accepted donors + contact (manager only) */}
      {r.isManager && (
        <Card>
          <h2 className="mb-3 font-bold">{t.request.acceptedDonors}</h2>
          {r.acceptedContacts.length === 0 ? (
            <p className="text-sm text-muted">{t.request.noAccepted}</p>
          ) : (
            <ul className="divide-y divide-border">
              {r.acceptedContacts.map((c) => (
                <li key={c.donationRequestId} className="flex flex-wrap items-center gap-3 py-3">
                  <BloodBadge group={c.bloodGroup ?? r.bloodGroup} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.name}</p>
                    {c.phone || c.email ? (
                      <p className="text-sm">
                        {c.phone && <a className="font-semibold text-primary" href={`tel:${c.phone}`}>{c.phone}</a>}
                        {c.phone && c.email && " · "}
                        {c.email && <a className="text-primary" href={`mailto:${c.email}`}>{c.email}</a>}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">{t.request.contactHidden}</p>
                    )}
                  </div>
                  <Badge tone="success">{t.donationRequestStatus[c.status as keyof typeof t.donationRequestStatus]}</Badge>
                  {c.phone && <LinkButton href={`tel:${c.phone}`} size="sm"><PhoneIcon className="size-4" /> {t.common.call}</LinkButton>}
                  <ReportButton targetUserId={c.donorId} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {r.isManager && active && <MatchList id={r.id} />}

      {r.isManager && r.responses.length > 0 && (
        <Card>
          <h2 className="mb-3 font-bold">{t.request.responses} <span className="text-sm font-normal text-muted">({r.counts.accepted}/{r.counts.contacted})</span></h2>
          <ul className="divide-y divide-border text-sm">
            {r.responses.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{d.donorName} <span className="text-muted">· {bloodLabel(d.bloodGroup)}{d.distanceKm != null ? ` · ~${d.distanceKm} ${t.common.km}` : ""}</span></span>
                <Badge tone={d.status === "ACCEPTED" || d.status === "DONATED" ? "success" : d.status === "DECLINED" ? "danger" : d.status === "PENDING" ? "warning" : "neutral"}>
                  {t.donationRequestStatus[d.status as keyof typeof t.donationRequestStatus]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.isStaff && active && centers.length > 0 && <IssueStock requestId={r.id} bloodGroup={r.bloodGroup} centers={centers} />}

      <Card>
        <h2 className="mb-3 font-bold">{t.request.timeline}</h2>
        <ol className="relative space-y-3 border-l border-border pl-4">
          {r.timeline.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-surface bg-primary" aria-hidden="true" />
              <p className="font-semibold">{t.requestStatus[e.toStatus as keyof typeof t.requestStatus]}</p>
              {e.note && <p className="text-muted">{e.note}</p>}
              <p className="text-xs text-muted">{formatDateTime(e.createdAt, locale)}</p>
            </li>
          ))}
        </ol>
      </Card>

      {viewer && !r.isManager && (
        <div className="flex justify-end">
          <ReportButton bloodRequestId={r.id} />
        </div>
      )}
      <p className="text-xs text-muted">{t.app.disclaimer}</p>
    </div>
  );
}
