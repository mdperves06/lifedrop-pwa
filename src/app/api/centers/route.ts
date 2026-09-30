import { handler, ok } from "@/server/http";
import { listCenters } from "@/server/services/centers";

export const GET = handler(async () => ok(await listCenters(), { headers: { "Cache-Control": "no-store" } }));
