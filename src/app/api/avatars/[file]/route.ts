import { NextResponse } from "next/server";
import { handler, notFound } from "@/server/http";
import { readAvatar } from "@/server/storage";

export const GET = handler<{ file: string }>(async (_req, { params }) => {
  const found = await readAvatar(params.file);
  if (!found) notFound("Image");
  return new NextResponse(new Uint8Array(found.data), {
    headers: {
      "Content-Type": found.type,
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
});
