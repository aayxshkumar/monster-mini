import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM ?? "Archivio <hello@archivio.app>";

export const resend = apiKey ? new Resend(apiKey) : null;

export function getResendFrom(): string {
  return from;
}
