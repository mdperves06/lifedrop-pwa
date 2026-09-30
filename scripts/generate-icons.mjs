// Rasterises the SVG logo into PWA icons (any + maskable), apple-touch and badge sizes.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const drop = (fill = "#ffffff") =>
  `<path d="M256 88C256 88 136 214 136 290a120 120 0 0 0 240 0C376 214 256 88 256 88z" fill="${fill}"/>` +
  `<path d="M208 300a48 48 0 0 0 48 48" stroke="#c8102e" stroke-width="18" stroke-linecap="round" fill="none" opacity="0.35"/>`;

const icon = (pad = 0, rounded = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="#c8102e"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">${drop()}</g>
</svg>`;

const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${drop("#000000")}</svg>`;

await mkdir("public/icons", { recursive: true });
const jobs = [
  ["icon-192.png", icon(0), 192],
  ["icon-512.png", icon(0), 512],
  ["maskable-192.png", icon(64, false), 192],
  ["maskable-512.png", icon(64, false), 512],
  ["apple-touch-icon.png", icon(24, false), 180],
  ["badge-72.png", badge, 72],
];
for (const [name, svg, size] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}`);
}
await writeFile("public/icons/icon.svg", icon(0));
// Favicon for the App Router (src/app/icon.svg)
await writeFile("src/app/icon.svg", icon(0));
console.log("Icons written to public/icons");
