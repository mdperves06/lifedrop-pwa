import { handler, ok } from "@/server/http";
import { allLocations } from "@/server/services/locations";

export const GET = handler(async () => {
  const locations = await allLocations();
  return ok(locations.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId })), {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
});
