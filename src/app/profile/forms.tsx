"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Badge, Button, Card, UserIcon } from "@/components/ui";
import { BloodGroupPicker, Checkbox, LocationPicker, SelectField, TextArea, TextField, Toggle, type Loc } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";
import { useToast } from "@/components/client/toast";
import { LanguageSwitch, ThemeToggle } from "@/components/client/shell";
import { PushToggle } from "@/components/client/push-toggle";

type U = { name: string; email: string; phone: string; locationId?: string; organization: string; note: string; dateOfBirth: string; gender: string; avatarPath: string | null; emailVerified: boolean; phoneVerified: boolean };
type D = { bloodGroup: string; weightKg: string; availability: string; emergencyAvailable: boolean; lastDonationDate: string; nextAvailableDate: string; healthDeclarationOk: boolean; sharePhoneAfterAccept: boolean; shareEmailAfterAccept: boolean; showInSearch: boolean };

export function ProfileForms({ user, donor, locations }: { user: U; donor: D | null; locations: Loc[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [u, setU] = useState({ ...user, loc: { areaId: user.locationId } as { divisionId?: string; districtId?: string; areaId?: string } });
  const [d, setD] = useState<D>(donor ?? { bloodGroup: "", weightKg: "", availability: "AVAILABLE", emergencyAvailable: true, lastDonationDate: "", nextAvailableDate: "", healthDeclarationOk: false, sharePhoneAfterAccept: true, shareEmailAfterAccept: false, showInSearch: true });
  const personal = useAction<{ phoneNeedsVerification: boolean }>();
  const donorA = useAction();
  const privacy = useAction();
  const del = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState(user.avatarPath);

  const upload = async (file: File) => {
    if (file.size > 1024 * 1024) return toast("error", t.profile.avatarHint);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/me/avatar", { method: "POST", body: fd });
    const json = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) return toast("error", json?.error?.message ?? t.common.errorGeneric);
    setAvatar(json.data.avatarPath);
    toast("success", t.common.saved);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* Personal */}
      <Card>
        <h2 className="mb-4 text-lg font-bold">{t.profile.personal}</h2>
        <div className="mb-4 flex items-center gap-4">
          <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-surface-2 text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served by our own route */}
            {avatar ? <img src={avatar} alt={t.profile.avatar} className="size-full object-cover" /> : <UserIcon className="size-8" />}
          </span>
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} aria-label={t.profile.uploadAvatar} />
            <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>{t.profile.uploadAvatar}</Button>
            <p className="mt-1 text-xs text-muted">{t.profile.avatarHint}</p>
          </div>
        </div>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            personal.run("/api/me", {
              method: "PATCH",
              body: { name: u.name, phone: u.phone, locationId: u.loc.areaId, organization: u.organization || null, note: u.note || null, dateOfBirth: u.dateOfBirth || null, gender: u.gender },
              success: t.common.saved,
            });
          }}
        >
          <TextField label={t.auth.fullName} name="name" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} error={personal.errors.name} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <TextField label={t.common.email} name="email" value={u.email} disabled />
              <Badge tone={user.emailVerified ? "success" : "warning"} className="mt-1">{user.emailVerified ? t.common.verified : t.common.unverified}</Badge>
            </div>
            <div>
              <TextField label={t.common.phone} name="phone" type="tel" value={u.phone} onChange={(e) => setU({ ...u, phone: e.target.value })} error={personal.errors.phone} />
              <Badge tone={user.phoneVerified ? "success" : "warning"} className="mt-1">{user.phoneVerified ? t.common.verified : t.common.unverified}</Badge>
            </div>
          </div>
          <LocationPicker value={u.loc} onChange={(v) => setU({ ...u, loc: v })} error={personal.errors.locationId} initialLocations={locations} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t.auth.dob} name="dateOfBirth" type="date" value={u.dateOfBirth} onChange={(e) => setU({ ...u, dateOfBirth: e.target.value })} error={personal.errors.dateOfBirth} />
            <SelectField label={t.auth.gender} name="gender" value={u.gender} onChange={(e) => setU({ ...u, gender: e.target.value })} options={(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const).map((g) => ({ value: g, label: t.auth[`gender${g}`] }))} />
          </div>
          <TextField label={`${t.profile.organization} (${t.common.optional})`} name="organization" value={u.organization} onChange={(e) => setU({ ...u, organization: e.target.value })} />
          <TextArea label={`${t.profile.note} (${t.common.optional})`} name="note" placeholder={t.profile.notePlaceholder} value={u.note} onChange={(e) => setU({ ...u, note: e.target.value })} maxLength={280} />
          <Button type="submit" loading={personal.pending}>{t.common.save}</Button>
        </form>
      </Card>

      {/* Donor */}
      <Card>
        <h2 className="mb-4 text-lg font-bold">{t.profile.donor}</h2>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            donorA.run("/api/me/donor", {
              method: "PATCH",
              body: {
                bloodGroup: d.bloodGroup || undefined, weightKg: d.weightKg || null, availability: d.availability, emergencyAvailable: d.emergencyAvailable,
                lastDonationDate: d.lastDonationDate || null, nextAvailableDate: d.nextAvailableDate || null, healthDeclarationOk: d.healthDeclarationOk,
              },
              success: t.common.saved,
            });
          }}
        >
          <BloodGroupPicker label={t.common.bloodGroup} value={d.bloodGroup} onChange={(v) => setD({ ...d, bloodGroup: v })} error={donorA.errors.bloodGroup} />
          <SelectField
            label={t.common.status}
            name="availability"
            value={d.availability}
            onChange={(e) => setD({ ...d, availability: e.target.value })}
            options={(["AVAILABLE", "TEMP_UNAVAILABLE", "NOT_AVAILABLE"] as const).map((a) => ({ value: a, label: t.availability[a] }))}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t.auth.weight} name="weightKg" type="number" inputMode="numeric" value={d.weightKg} onChange={(e) => setD({ ...d, weightKg: e.target.value })} error={donorA.errors.weightKg} />
            <TextField label={t.auth.lastDonation} name="lastDonationDate" type="date" max={new Date().toISOString().slice(0, 10)} value={d.lastDonationDate} onChange={(e) => setD({ ...d, lastDonationDate: e.target.value })} error={donorA.errors.lastDonationDate} />
            <TextField label={`${t.profile.nextAvailable} (${t.common.optional})`} name="nextAvailableDate" type="date" value={d.nextAvailableDate} onChange={(e) => setD({ ...d, nextAvailableDate: e.target.value })} />
          </div>
          <Toggle label={t.profile.emergencyAvailable} checked={d.emergencyAvailable} onChange={(v) => setD({ ...d, emergencyAvailable: v })} />
          <Checkbox label={t.auth.healthDeclaration} checked={d.healthDeclarationOk} onChange={(v) => setD({ ...d, healthDeclarationOk: v })} />
          <p className="text-xs text-muted">{t.app.disclaimer}</p>
          <Button type="submit" loading={donorA.pending}>{t.common.save}</Button>
        </form>
      </Card>

      {/* Privacy */}
      <Card>
        <h2 className="mb-1 text-lg font-bold">{t.profile.privacy}</h2>
        <p className="mb-3 text-sm text-muted">{t.profile.privacyNote}</p>
        {(["showInSearch", "sharePhoneAfterAccept", "shareEmailAfterAccept"] as const).map((k) => (
          <Toggle
            key={k}
            label={k === "showInSearch" ? t.profile.showInSearch : k === "sharePhoneAfterAccept" ? t.profile.sharePhone : t.profile.shareEmail}
            checked={d[k]}
            disabled={privacy.pending || !donor}
            onChange={(v) => {
              setD({ ...d, [k]: v });
              privacy.run("/api/me/donor", { method: "PATCH", body: { [k]: v }, success: t.common.saved, onError: () => setD((s) => ({ ...s, [k]: !v })) });
            }}
          />
        ))}
      </Card>

      {/* Preferences */}
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">{t.profile.security}</h2>
        <div className="flex flex-wrap gap-3">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
        <PushToggle />
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary">{t.nav.logout}</Button>
          </form>
          <Button
            variant="ghost"
            className="text-danger"
            loading={del.pending}
            onClick={async () => {
              if (!confirm(t.profile.deleteConfirm)) return;
              const ok = await del.run("/api/me", { method: "DELETE", success: t.profile.deleted, refresh: false });
              if (ok) {
                navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE" });
                router.replace("/");
                router.refresh();
              }
            }}
          >
            {t.profile.deleteAccount}
          </Button>
        </div>
      </Card>
    </div>
  );
}
