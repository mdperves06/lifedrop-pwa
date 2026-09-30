import { handler, ok, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { saveAvatar, removeAvatar } from "@/server/storage";

export const POST = handler(
  async (req) => {
    const u = await requireUser();
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(422, "VALIDATION_ERROR", "Choose an image to upload.", { file: "Required" });
    const path = await saveAvatar(u.id, file);
    if (u.avatarPath) await removeAvatar(u.avatarPath);
    await db.user.update({ where: { id: u.id }, data: { avatarPath: path } });
    return ok({ avatarPath: path });
  },
  { rateLimit: { key: "avatar", limit: 10, windowMs: 60 * 60_000 } },
);

export const DELETE = handler(async () => {
  const u = await requireUser();
  if (u.avatarPath) await removeAvatar(u.avatarPath);
  await db.user.update({ where: { id: u.id }, data: { avatarPath: null } });
  return ok({ removed: true });
});
