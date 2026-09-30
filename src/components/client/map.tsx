"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapPoint = { id: string; lat: number; lng: number; label: string; status?: "OPEN" | "CLOSED" | "FULL"; href?: string };

const COLORS = { OPEN: "#137a3f", FULL: "#9a6300", CLOSED: "#6b6b76" } as const;

/**
 * OpenStreetMap via Leaflet — no API key needed. If NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set,
 * single-center views use a Google Maps embed instead (see CenterMapEmbed).
 */
export function CentersMap({ points, userPos, height = 320, zoom = 12 }: { points: MapPoint[]; userPos?: { lat: number; lng: number } | null; height?: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!mapRef.current) {
        const center = points[0] ?? { lat: 23.7808, lng: 90.4 };
        mapRef.current = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const layer = layerRef.current!;
      layer.clearLayers();
      const bounds: [number, number][] = [];
      for (const p of points) {
        const color = COLORS[p.status ?? "OPEN"];
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c8102e;border:3px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        const m = L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label }).addTo(layer);
        const a = document.createElement("a");
        a.textContent = p.label;
        a.href = p.href ?? "#";
        a.style.fontWeight = "600";
        m.bindPopup(a);
        bounds.push([p.lat, p.lng]);
      }
      if (userPos) {
        L.circleMarker([userPos.lat, userPos.lng], { radius: 8, color: "#1d5fbf", fillColor: "#1d5fbf", fillOpacity: 0.8 }).addTo(layer).bindTooltip("You");
        bounds.push([userPos.lat, userPos.lng]);
      }
      if (bounds.length > 1) mapRef.current!.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    })();
    return () => {
      cancelled = true;
    };
  }, [points, userPos, zoom]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return <div ref={el} style={{ height }} className="w-full overflow-hidden rounded-xl border border-border bg-surface-2" role="region" aria-label="Map of donation centers" />;
}

export function CenterMapEmbed({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return <CentersMap points={[{ id: "c", lat, lng, label }]} zoom={15} height={260} />;
  return (
    <iframe
      title={label}
      className="h-64 w-full rounded-xl border border-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${lat},${lng}&zoom=15`}
    />
  );
}
