import "dotenv/config";
import { execFileSync } from "node:child_process";

/** Apply pending migrations to the test database before the suite runs. */
export default function globalSetup(): void {
  const url = process.env["TEST_DATABASE_URL"] ?? "postgresql://nexus:nexus_dev_only@localhost:5432/nexus_test";
  execFileSync("npx", ["tsx", "scripts/migrate-sql.ts"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
