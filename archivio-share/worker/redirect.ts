// Use web build for Cloudflare Workers (fetch-based)
import { createClient } from "@libsql/client/web";

export interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  APP_URL: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: unknown
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, "").trim();
    const shortCode = path.split("/")[0];
    if (!shortCode || shortCode.length !== 8) {
      return Response.redirect(`${env.APP_URL}/not-found`, 302);
    }
    const client = createClient({
      url: env.TURSO_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    const row = await client.execute({
      sql: "SELECT id FROM photos WHERE short_code = ? LIMIT 1",
      args: [shortCode],
    });
    const id = row.rows[0]?.id;
    if (typeof id !== "string") {
      return Response.redirect(`${env.APP_URL}/not-found`, 302);
    }
    return Response.redirect(`${env.APP_URL}/photo/${id}`, 302);
  },
};
