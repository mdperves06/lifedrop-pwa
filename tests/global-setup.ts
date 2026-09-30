import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// Every run starts from a brand-new, test-only SQLite file (prisma/test.db) — never the dev database.
export default function setup() {
  const file = path.resolve(__dirname, "..", "prisma", "test.db");
  rmSync(file, { force: true });
  rmSync(`${file}-journal`, { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
}
