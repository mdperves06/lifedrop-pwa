import { z } from "zod";
import { NextResponse } from "next/server";
import { handler, parseQuery } from "@/server/http";
import { slotAvailability } from "@/server/services/centers";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const { from, days } = parseQuery(req, z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), days: z.coerce.number().int().min(1).max(31).default(14) }));
  const data = await slotAvailability(params.id, from, days);
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
});
