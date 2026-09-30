// End-to-end smoke test against a running dev server (npm run dev) with seeded demo data.
//   node scripts/smoke.mjs [baseUrl]
// Exercises the main journeys: requester → emergency request → donor accepts → contact revealed → fulfilled,
// appointments, staff donation recording, reports, and authorization boundaries.
const BASE = process.argv[2] || "http://localhost:3000";
const PASSWORD = "Demo@1234"; // demo seed password (prisma/seed.ts)
let failures = 0;

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: BASE, Cookie: this.cookie, Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("ld_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }
  login(identifier) {
    return this.req("POST", "/api/auth/login", { identifier, password: PASSWORD });
  }
}

function check(label, cond, extra) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
  }
}

const anon = new Client("anon");
const requester = new Client("requester");
const donor = new Client("donor");
const admin = new Client("admin");
const staff = new Client("staff");

console.log("Auth");
check("health endpoint", (await anon.req("GET", "/api/health")).status === 200);
check("bad password rejected", (await new Client("x").req("POST", "/api/auth/login", { identifier: "donor@lifedrop.test", password: "wrong" })).status === 401);
for (const [c, id] of [[requester, "requester@lifedrop.test"], [donor, "donor@lifedrop.test"], [admin, "admin@lifedrop.test"], [staff, "staff@lifedrop.test"]]) {
  const r = await c.login(id);
  check(`${c.name} login`, r.status === 200 && !!c.cookie, r.json);
}
check("cross-site POST blocked", (await fetch(BASE + "/api/notifications/read", { method: "POST", headers: { Origin: "https://evil.example", Cookie: donor.cookie, "Content-Type": "application/json" }, body: "{}" })).status === 403);
check("anon cannot create request", (await anon.req("POST", "/api/requests", {})).status === 401);

console.log("Locations & search");
const locs = (await anon.req("GET", "/api/locations")).json.data;
const shahbagh = locs.find((l) => l.name === "Shahbagh");
const dhanmondi = locs.find((l) => l.name === "Dhanmondi");
check("locations loaded", !!shahbagh && !!dhanmondi);
const s1 = await anon.req("GET", `/api/donors?bloodGroup=O_POS&districtId=${shahbagh.parentId}`);
check("donor search returns results", s1.status === 200 && s1.json.data.total > 0, s1.json);
check("search hides phone/email", s1.json.data.donors.every((d) => !("phone" in d) && !("email" in d)));
check("anon sees abbreviated names", s1.json.data.donors.every((d) => /\.$/.test(d.displayName) || !d.displayName.includes(" ")));
check("invalid blood group rejected", (await anon.req("GET", "/api/donors?bloodGroup=Z_POS")).status === 422);

console.log("Emergency request flow");
const needed = new Date(Date.now() + 3 * 3600_000).toISOString();
const created = await requester.req("POST", "/api/requests", {
  bloodGroup: "O_POS", units: 1, patientName: "Smoke Test Patient", hospitalName: `Smoke Hospital ${Date.now()}`, locationId: shahbagh.id,
  neededAt: needed, priority: "EMERGENCY", contactPreference: "BOTH", contactPhone: "01711111111",
});
check("emergency request created", created.status === 201, created.json);
const reqId = created.json?.data?.id;
check("nearby donors auto-notified", created.json?.data?.autoNotified > 0, created.json);
const dup = await requester.req("POST", "/api/requests", {
  bloodGroup: "O_POS", units: 1, patientName: "Smoke Test Patient", hospitalName: created.json?.data ? `Smoke Hospital ${reqId}` : "x", locationId: shahbagh.id, neededAt: needed, priority: "EMERGENCY",
});
check("second distinct request allowed", dup.status === 201 || dup.status === 403, dup.json);

const board = await anon.req("GET", "/api/requests");
check("public board hides patient names", !JSON.stringify(board.json).includes("Smoke Test Patient"));

// Main demo donor is O+ in Dhanmondi (~1.5 km from Shahbagh) and emergency-available.
const notes = await donor.req("GET", "/api/notifications");
const alert = notes.json.data.items.find((n) => n.type === "EMERGENCY_ALERT" && n.link?.startsWith("/incoming/"));
check("donor received emergency notification", !!alert, notes.json.data.items.slice(0, 3));
const drId = alert?.link.split("/").pop();
check("other user cannot respond for donor", (await requester.req("POST", `/api/donation-requests/${drId}/respond`, { action: "ACCEPT" })).status === 404);
const acc = await donor.req("POST", `/api/donation-requests/${drId}/respond`, { action: "ACCEPT" });
check("donor accepts", acc.status === 200 && acc.json.data.status === "ACCEPTED", acc.json);
check("accept is idempotent", (await donor.req("POST", `/api/donation-requests/${drId}/respond`, { action: "ACCEPT" })).status === 200);
const reqNotes = await requester.req("GET", "/api/notifications");
check("requester notified of acceptance", reqNotes.json.data.items.some((n) => n.type === "REQUEST_ACCEPTED"));

const page = await fetch(`${BASE}/requests/${reqId}`, { headers: { Cookie: requester.cookie } }).then((r) => r.text());
check("requester sees accepted donor phone", page.includes("Demo Donor Rahim") && /\+8801\d{9}/.test(page));
const anonPage = await fetch(`${BASE}/requests/${reqId}`).then((r) => r.text());
check("anon request page hides patient name", !anonPage.includes("Smoke Test Patient"));

check("donor cannot cancel someone else's request", (await donor.req("POST", `/api/requests/${reqId}/action`, { action: "CANCEL" })).status === 403);
const ful = await requester.req("POST", `/api/requests/${reqId}/action`, { action: "FULFILL" });
check("requester marks fulfilled", ful.status === 200 && ful.json.data.status === "FULFILLED", ful.json);
check("invalid transition rejected", (await requester.req("POST", `/api/requests/${reqId}/action`, { action: "CANCEL" })).status === 409);
if (dup.status === 201) {
  const c = await requester.req("POST", `/api/requests/${dup.json.data.id}/action`, { action: "CANCEL" });
  check("requester cancels second request", c.status === 200 && c.json.data.status === "CANCELLED", c.json);
}

console.log("Appointments");
const centers = (await anon.req("GET", "/api/centers")).json.data;
const center = centers.find((c) => c.name.includes("Dhanmondi"));
const days = (await anon.req("GET", `/api/centers/${center.id}/slots?days=14`)).json.data;
const slot = days.flatMap((d) => d.slots).find((s) => !s.past && s.remaining > 0);
check("slots available", !!slot);
const book = await donor.req("POST", "/api/appointments", { centerId: center.id, startsAt: slot.startsAt });
check("donor books appointment", book.status === 201, book.json);
check("double booking blocked", (await donor.req("POST", "/api/appointments", { centerId: center.id, startsAt: slot.startsAt })).status === 409);
check("off-slot time rejected", (await requester.req("POST", "/api/appointments", { centerId: center.id, startsAt: new Date(Date.parse(slot.startsAt) + 17 * 60000).toISOString() })).status >= 409);
const cancel = await donor.req("DELETE", `/api/appointments/${book.json?.data?.id}`, {});
check("donor cancels appointment", cancel.status === 200, cancel.json);

console.log("Staff & inventory");
const inv = (await anon.req("GET", "/api/inventory")).json.data;
check("public inventory has 8 groups", inv.length === 8);
check("donor cannot adjust stock", (await donor.req("POST", "/api/inventory", { centerId: center.id, bloodGroup: "O_POS", units: 1, mode: "ADD" })).status === 403);
const add = await staff.req("POST", "/api/inventory", { centerId: center.id, bloodGroup: "AB_NEG", units: 2, mode: "ADD", note: "smoke" });
check("staff adds stock", add.status === 200 && add.json.data.after === add.json.data.before + 2, add.json);
const other = centers.find((c) => c.id !== center.id);
check("staff cannot touch other center", (await staff.req("POST", "/api/inventory", { centerId: other.id, bloodGroup: "AB_NEG", units: 1, mode: "ADD" })).status === 403);
const issue = await staff.req("POST", "/api/inventory", { centerId: center.id, bloodGroup: "AB_NEG", units: 2, mode: "ISSUE" });
check("staff issues stock", issue.status === 200, issue.json);
check("over-issue rejected", (await staff.req("POST", "/api/inventory", { centerId: center.id, bloodGroup: "AB_NEG", units: 400, mode: "ISSUE" })).status === 409);

console.log("Reports & admin");
const rep = await donor.req("POST", "/api/reports", { bloodRequestId: reqId, reason: "SPAM", details: "smoke test" });
check("report submitted", rep.status === 201 || rep.status === 200, rep.json);
check("donor cannot read admin settings", (await donor.req("GET", "/api/admin/settings")).status === 403);
check("donor cannot promote self", (await donor.req("PATCH", "/api/admin/users/whatever", { role: "ADMIN" })).status === 403);
check("admin reads settings", (await admin.req("GET", "/api/admin/settings")).status === 200);
const resolved = await admin.req("PATCH", `/api/admin/reports/${rep.json?.data?.id}`, { status: "DISMISSED", action: "NONE", adminNote: "smoke" });
check("admin resolves report", resolved.status === 200, resolved.json);
const ann = await admin.req("POST", "/api/admin/announcements", { title: "Smoke announcement", message: "Hello from the smoke test", audience: "STAFF", push: false });
check("admin sends announcement", ann.status === 201 && ann.json.data.recipients > 0, ann.json);
check("cron requires secret", (await anon.req("GET", "/api/cron/run")).status === 401);
const cron = await fetch(BASE + "/api/cron/run", { headers: { Authorization: "Bearer dev-cron-secret" } });
check("cron runs with secret", cron.status === 200);

console.log("Profile & privacy");
const tog = await donor.req("PATCH", "/api/me/donor", { availability: "TEMP_UNAVAILABLE" });
check("donor toggles availability", tog.status === 200 && tog.json.data.availability === "TEMP_UNAVAILABLE");
const s2 = await anon.req("GET", `/api/donors?bloodGroup=O_POS&areaId=${dhanmondi.id}`);
check("unavailable donor hidden from 'available now'", !s2.json.data.donors.some((d) => d.displayName.startsWith("Demo D")));
await donor.req("PATCH", "/api/me/donor", { availability: "AVAILABLE" });
const logout = await donor.req("POST", "/api/auth/logout");
check("logout clears session", logout.status === 200 && !donor.cookie);
check("after logout /api/me is 401", (await donor.req("GET", "/api/me")).status === 401);

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll smoke checks passed");
process.exit(failures ? 1 : 0);
