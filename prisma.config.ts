import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    // DATABASE_URL is optional for `prisma generate` (no DB connection needed).
    // Required for `prisma db pull`. Set in .env.local (server secret, never NEXT_PUBLIC).
    url: process.env["DATABASE_URL"],
  },
});
