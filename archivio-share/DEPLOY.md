# archivio-share — Deploy & E2E

## Deploy order

1. **Turso** — Create DB, run `npm run db:push` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. **Vercel** — Deploy this app; set all env vars from `.env.example`.
3. **Cloudflare** — Create R2 bucket, create Worker from `worker/redirect.ts` with `wrangler deploy --config worker/wrangler.toml`; set secrets `TURSO_URL`, `TURSO_AUTH_TOKEN`, `APP_URL`.
4. **QStash** — Enable in Upstash; set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`.
5. **Resend** — Domain + API key; set `RESEND_API_KEY`, `RESEND_FROM`; optionally configure webhook to `POST /api/webhook/email-status`.

## E2E test flow

1. **Print** — In archivio-dashboard, add a photo, enable QR, set share URL env, click Confirm & Print. Receipt prints with QR (archivio.link/XXXXXXXX).
2. **Scan** — Open QR URL; see “developing” then photo page when upload completes.
3. **Share** — Use Share / Save / Email me this photo / Time capsule.
4. **Capsule** — Submit capsule form; receive confirmation email with cancel link.
5. **Delivery** — After the chosen delay, QStash calls `/api/capsule/send`; capsule email is sent and status set to delivered.

## Scripts

- `npm run db:push` — Apply schema to Turso (or local SQLite with `TURSO_DATABASE_URL=file:./local.db`).
- `npm run seed` — Insert default email template and sample event.
- `npm run cleanup` — Mark expired photos, delete old delivered capsules.
- `npm run deploy:worker` — Deploy Cloudflare Worker (from project root).
