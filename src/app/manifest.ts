import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LifeDrop — Blood Donation",
    short_name: "LifeDrop",
    description: "Find blood donors, book donations and post emergency blood requests.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#c8102e",
    lang: "en",
    categories: ["health", "medical", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Emergency request", short_name: "Emergency", url: "/requests/new?priority=EMERGENCY", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find donors", short_name: "Find", url: "/donors", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Book appointment", short_name: "Book", url: "/appointments/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
