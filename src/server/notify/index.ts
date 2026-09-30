import "server-only";
import type { NotificationType } from "@prisma/client";
import { db } from "@/server/db";
import { sendPushToUsers, sendSms, sendEmail, type PushPayload } from "@/server/notify/channels";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  bloodRequestId?: string;
  donationRequestId?: string;
};

type Channels = { push?: boolean; sms?: boolean; email?: boolean; urgent?: boolean };

/**
 * Creates in-app notifications (source of truth) and fans out to push/SMS/email.
 * External channel failures never fail the operation — the in-app record exists.
 */
export async function notify(items: NotifyInput[], channels: Channels = { push: true }) {
  if (items.length === 0) return [];
  const created = await db.$transaction(items.map((n) => db.notification.create({ data: n })));

  if (channels.push) {
    // Group by identical payload to minimise lookups.
    await Promise.all(
      created.map((n) =>
        sendPushToUsers([n.userId], {
          title: n.title,
          body: n.message,
          url: n.link ?? "/notifications",
          tag: n.donationRequestId ?? n.bloodRequestId ?? n.id,
          urgent: channels.urgent,
          donationRequestId: n.type === "DONATION_REQUEST" || n.type === "EMERGENCY_ALERT" ? n.donationRequestId ?? undefined : undefined,
        } satisfies PushPayload),
      ),
    );
  }

  if (channels.sms || channels.email) {
    const users = await db.user.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.userId))] }, status: "ACTIVE" },
      select: { id: true, phone: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    await Promise.all(
      created.map(async (n) => {
        const u = byId.get(n.userId);
        if (!u) return;
        if (channels.sms) await sendSms(u.phone, `${n.title}\n${n.message}`);
        if (channels.email) await sendEmail(u.email, n.title, n.message);
      }),
    );
  }
  return created;
}

export async function notifyAdmins(input: Omit<NotifyInput, "userId">, channels?: Channels) {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return notify(admins.map((a) => ({ ...input, userId: a.id })), channels);
}
