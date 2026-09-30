// Fetches every page as a given demo user and reports non-200s or error UIs.
//   node scripts/crawl.mjs [email] [baseUrl]
const email = process.argv[2] || "admin@lifedrop.test";
const BASE = process.argv[3] || "http://localhost:3000";
const login = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ identifier: email, password: "Demo@1234" }) });
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const urls = ["/", "/learn", "/eligibility", "/centers", "/inventory", "/campaigns", "/requests", "/requests/new", "/donors", "/donors?bloodGroup=AB_NEG&compatible=1", "/dashboard", "/my-requests", "/my-requests?tab=completed", "/incoming", "/appointments", "/appointments/new", "/notifications", "/profile", "/center", "/hospital", "/admin", "/admin/analytics", "/admin/users", "/admin/users?role=DONOR&q=a", "/admin/requests", "/admin/reports", "/admin/reports?tab=closed", "/admin/inventory", "/admin/appointments", "/admin/appointments?tab=past", "/admin/campaigns", "/admin/centers", "/admin/locations", "/admin/announcements", "/admin/audit", "/admin/settings", "/offline", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/sw.js", "/nope-404"];
let bad = 0;
for (const u of urls) {
  const t0 = Date.now();
  const r = await fetch(BASE + u, { headers: { Cookie: cookie }, redirect: "manual" });
  const body = await r.text();
  const err = /\\"digest\\":\\"|"digest":"|__next_error__/.test(body);
  const ok = (r.status === 200 || (u === "/nope-404" && r.status === 404) || (r.status === 403 && /\/(center|hospital|admin)/.test(u))) && !err;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${r.status} ${u}${err ? " (error UI)" : ""} ${Date.now() - t0}ms`);
}
console.log(bad ? `${bad} problem(s)` : "all pages ok");
