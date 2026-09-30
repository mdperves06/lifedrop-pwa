import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { requestActionSchema } from "@/lib/validation";
import { actOnRequest } from "@/server/services/requests";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { action, note, unitsFulfilled } = await parseJson(req, requestActionSchema);
  const r = await actOnRequest(user, params.id, action, { note, unitsFulfilled });
  return ok({ id: r?.id, status: r?.status });
});
