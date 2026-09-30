import { z } from "zod";
import { NextResponse } from "next/server";
import { handler, ok, parseJson, parseQuery } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { inventoryAdjustSchema } from "@/lib/validation";
import { adjustInventory, stockByGroup } from "@/server/services/inventory";

// Public: only aggregated levels (no batch details).
export const GET = handler(async (req) => {
  const { centerId } = parseQuery(req, z.object({ centerId: z.string().max(40).optional() }));
  const levels = await stockByGroup(centerId);
  return NextResponse.json({ data: levels }, { headers: { "Cache-Control": "public, max-age=30" } });
});

export const POST = handler(async (req) => {
  const user = await requireRole("CENTER_STAFF", "ADMIN");
  const input = await parseJson(req, inventoryAdjustSchema);
  return ok(await adjustInventory(user, input));
});
