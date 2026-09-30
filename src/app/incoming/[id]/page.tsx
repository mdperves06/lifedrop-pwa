import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";

// Notification deep-link target: resolves a donation-request id to its blood request page.
export default async function IncomingRedirect({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const dr = await db.donationRequest.findUnique({ where: { id }, select: { donorId: true, bloodRequestId: true } });
  if (!dr || dr.donorId !== user.id) notFound();
  // Opening the link marks the related notification as read.
  await db.notification.updateMany({ where: { userId: user.id, donationRequestId: id, readAt: null }, data: { readAt: new Date() } });
  redirect(`/requests/${dr.bloodRequestId}`);
}
