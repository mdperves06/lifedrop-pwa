import type { MetadataRoute } from "next";

const base = process.env.APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/learn", "/eligibility", "/centers", "/inventory", "/campaigns", "/requests"],
        disallow: ["/api/", "/admin", "/dashboard", "/profile", "/my-requests", "/incoming", "/appointments", "/notifications", "/center", "/hospital", "/verify", "/reset-password", "/donors"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
