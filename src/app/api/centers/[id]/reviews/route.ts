import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { reviewSchema } from "@/lib/validation";
import { db } from "@/server/db";

// Only donors who actually donated / completed an appointment at the center may review it.
export const POST = handler<{ id: string }>(
  async (req, { params }) => {
    const user = await requireUser();
    const { rating, comment } = await parseJson(req, reviewSchema);
    const visited =
      (await db.appointment.count({ where: { donorId: user.id, centerId: params.id, status: "COMPLETED" } })) +
      (await db.donation.count({ where: { donorId: user.id, centerId: params.id } }));
    if (!visited) throw new ApiError(403, "NOT_VISITED", "You can review a center after donating there.");
    const review = await db.review.upsert({
      where: { centerId_userId: { centerId: params.id, userId: user.id } },
      create: { centerId: params.id, userId: user.id, rating, comment },
      update: { rating, comment, createdAt: new Date() },
    });
    return ok({ id: review.id }, 201);
  },
  { rateLimit: { key: "review", limit: 10, windowMs: 60 * 60_000 } },
);
