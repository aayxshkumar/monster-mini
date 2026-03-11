import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const isRemote = url.startsWith("libsql://") || url.startsWith("https://");

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    ...(isRemote && process.env.TURSO_AUTH_TOKEN
      ? { authToken: process.env.TURSO_AUTH_TOKEN }
      : {}),
  },
});
