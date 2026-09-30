"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button, inputClass } from "@/components/ui";
import { useAction } from "@/components/client/use-action";

type U = { id: string; role: string; status: string; centerId: string | null; hospitalId: string | null; emailVerified: boolean };

export function UserActions({ user, centers, hospitals }: { user: U; centers: { id: string; name: string }[]; hospitals: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [role, setRole] = useState(user.role);
  const [centerId, setCenterId] = useState(user.centerId ?? "");
  const [hospitalId, setHospitalId] = useState(user.hospitalId ?? "");
  const { run, pending } = useAction();
  const patch = (body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    run(`/api/admin/users/${user.id}`, { method: "PATCH", body, success: t.common.saved });
  };
  const roleChanged = role !== user.role || (role === "CENTER_STAFF" && centerId !== (user.centerId ?? "")) || (role === "HOSPITAL" && hospitalId !== (user.hospitalId ?? ""));
  return (
    <div className="flex min-w-56 flex-col gap-2">
      <div className="flex gap-1">
        <select aria-label={t.admin.role} value={role} onChange={(e) => setRole(e.target.value)} className={inputClass + " min-h-9 py-1 text-sm"}>
          {["DONOR", "CENTER_STAFF", "HOSPITAL", "ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {roleChanged && (
          <Button size="sm" loading={pending} onClick={() => patch({ role, centerId: role === "CENTER_STAFF" ? centerId || null : null, hospitalId: role === "HOSPITAL" ? hospitalId || null : null }, `Change role to ${role}?`)}>
            {t.common.save}
          </Button>
        )}
      </div>
      {role === "CENTER_STAFF" && (
        <select aria-label={t.admin.centers} value={centerId} onChange={(e) => setCenterId(e.target.value)} className={inputClass + " min-h-9 py-1 text-sm"}>
          <option value="">—</option>
          {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {role === "HOSPITAL" && (
        <select aria-label="Hospital" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className={inputClass + " min-h-9 py-1 text-sm"}>
          <option value="">—</option>
          {hospitals.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="flex flex-wrap gap-1">
        {user.status === "ACTIVE" ? (
          <Button size="sm" variant="outline" loading={pending} onClick={() => patch({ status: "SUSPENDED" }, `${t.admin.suspend}?`)}>{t.admin.suspend}</Button>
        ) : (
          <Button size="sm" variant="outline" loading={pending} onClick={() => patch({ status: "ACTIVE" })}>{t.admin.activate}</Button>
        )}
        {user.status !== "REMOVED" && <Button size="sm" variant="ghost" className="text-danger" loading={pending} onClick={() => patch({ status: "REMOVED" }, `${t.admin.remove}?`)}>{t.admin.remove}</Button>}
        {!user.emailVerified && <Button size="sm" variant="ghost" loading={pending} onClick={() => patch({ verifyEmail: true })}>{t.common.verified} ✓</Button>}
      </div>
    </div>
  );
}
