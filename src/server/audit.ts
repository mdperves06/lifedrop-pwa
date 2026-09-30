import "server-only";
import { db } from "@/server/db";

export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the user-facing operation, but it must be visible.
    console.error("[audit] failed to write audit log", err);
  }
}
