import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 config. DATABASE_URL is read from the environment (.env locally).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations should use a direct connection; Neon/Vercel expose it as DATABASE_URL_UNPOOLED.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
