import { handler, ok, parseQuery } from "@/server/http";
import { donorSearchSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { searchDonors } from "@/server/services/donors";

export const GET = handler(
  async (req) => {
    const q = parseQuery(req, donorSearchSchema);
    const viewer = await getSessionUser();
    const result = await searchDonors(
      {
        bloodGroup: q.bloodGroup,
        compatible: q.compatible === "1",
        divisionId: q.divisionId,
        districtId: q.districtId,
        areaId: q.areaId,
        availableNow: q.availableNow !== "0",
        emergency: q.emergency === "1",
        recentlyActive: q.recentlyActive === "1",
        page: q.page,
      },
      { signedIn: !!viewer, userId: viewer?.id },
    );
    return ok(result);
  },
  // Throttle scraping of the donor directory.
  { rateLimit: { key: "donor-search", limit: 60, windowMs: 60_000 } },
);
