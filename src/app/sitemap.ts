import type { MetadataRoute } from "next";

const base = process.env.APP_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/learn", "/eligibility", "/centers", "/inventory", "/campaigns", "/requests", "/register", "/login"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === "/inventory" || p === "/requests" ? "hourly" : "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
