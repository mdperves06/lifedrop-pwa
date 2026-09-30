import { handler, ok, parseJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { announcementSchema } from "@/lib/validation";
import { sendAnnouncement } from "@/server/services/admin";

export const POST = handler(
  async (req) => {
    const admin = await requireRole("ADMIN");
    const input = await parseJson(req, announcementSchema);
    const a = await sendAnnouncement(admin, input);
    return ok({ id: a.id, recipients: a.recipients }, 201);
  },
  { rateLimit: { key: "announce", limit: 10, windowMs: 60 * 60_000 } },
);
