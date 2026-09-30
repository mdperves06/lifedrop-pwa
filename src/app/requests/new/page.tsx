import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { getSessionUser, isVerified } from "@/server/auth/session";
import { allLocations } from "@/server/services/locations";
import { db } from "@/server/db";
import { Alert, LinkButton, PageHeader, EmptyState } from "@/components/ui";
import { RequestForm } from "./form";

export const metadata: Metadata = { title: "Request blood", robots: { index: false } };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ priority?: string; bloodGroup?: string }> }) {
  const [{ t }, user, locs, sp] = await Promise.all([getDictionary(), getSessionUser(), allLocations(), searchParams]);
  if (!user) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title={t.request.newTitle} subtitle={t.request.newSubtitle} />
        <EmptyState
          title={t.common.signInToContinue}
          action={
            <div className="flex gap-2">
              <LinkButton href={`/login?next=${encodeURIComponent(`/requests/new${sp.priority ? `?priority=${sp.priority}` : ""}`)}`}>{t.nav.login}</LinkButton>
              <LinkButton variant="outline" href="/register">{t.auth.createAccount}</LinkButton>
            </div>
          }
        />
      </div>
    );
  }
  const hospital = user.hospitalId ? await db.hospital.findUnique({ where: { id: user.hospitalId } }) : null;
  const priority = sp.priority === "EMERGENCY" || sp.priority === "URGENT" ? sp.priority : "NORMAL";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.request.newTitle} subtitle={t.request.newSubtitle} />
      {!isVerified(user) && <Alert tone="warning" className="mb-4">{t.request.unverifiedNote}</Alert>}
      <RequestForm
        locations={locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }))}
        defaults={{
          priority,
          bloodGroup: sp.bloodGroup ?? "",
          hospitalName: hospital?.name ?? "",
          hospitalAddress: hospital?.address ?? "",
          hospitalId: hospital?.id ?? null,
          areaId: hospital?.locationId ?? user.locationId ?? undefined,
          contactPhone: hospital?.phone ?? user.phone,
        }}
      />
    </div>
  );
}
