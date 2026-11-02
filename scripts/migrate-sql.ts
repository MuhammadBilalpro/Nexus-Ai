/**
 * Engine-free migration runner.
 *
 * Applies pending SQL migrations from prisma/migrations in the same way
 * `prisma migrate deploy` does, and records them in `_prisma_migrations`
 * with a compatible checksum. Use it in environments where the Prisma
 * schema engine binary cannot be downloaded; `prisma migrate deploy`
 * remains the preferred path everywhere else and sees these as applied.
 *
 * Usage: npm run db:migrate:sql
 */
import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations");

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);

    const applied = new Set(
      (
        await client.query<{ migration_name: string }>(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
        )
      ).rows.map((r) => r.migration_name),
    );

    const entries = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    let count = 0;
    for (const name of entries) {
      if (applied.has(name)) continue;
      const file = path.join(MIGRATIONS_DIR, name, "migration.sql");
      const sql = await readFile(file, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const id = randomUUID();

      console.log(`Applying ${name} ...`);
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES ($1, $2, $3, now())`,
          [id, checksum, name],
        );
        await client.query(sql);
        await client.query(
          `UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`,
          [id],
        );
        await client.query("COMMIT");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log(count === 0 ? "Database is up to date." : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
