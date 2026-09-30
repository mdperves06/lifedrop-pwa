import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { allLocations } from "@/server/services/locations";
import { PageHeader } from "@/components/ui";
import { ProfileForms } from "./forms";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requirePageUser();
  const [{ t }, full, locs] = await Promise.all([getDictionary(), db.user.findUnique({ where: { id: user.id }, include: { donorProfile: true } }), allLocations()]);
  const u = full!;
  const dp = u.donorProfile;
  const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : "");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.profile.title} />
      <ProfileForms
        locations={locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }))}
        user={{
          name: u.name, email: u.email, phone: u.phone, locationId: u.locationId ?? undefined, organization: u.organization ?? "", note: u.note ?? "",
          dateOfBirth: d(u.dateOfBirth), gender: u.gender, avatarPath: u.avatarPath, emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt,
        }}
        donor={
          dp
            ? {
                bloodGroup: dp.bloodGroup, weightKg: dp.weightKg ? String(dp.weightKg) : "", availability: dp.availability, emergencyAvailable: dp.emergencyAvailable,
                lastDonationDate: d(dp.lastDonationDate), nextAvailableDate: d(dp.nextAvailableDate), healthDeclarationOk: dp.healthDeclarationOk,
                sharePhoneAfterAccept: dp.sharePhoneAfterAccept, shareEmailAfterAccept: dp.shareEmailAfterAccept, showInSearch: dp.showInSearch,
              }
            : null
        }
      />
    </div>
  );
}
