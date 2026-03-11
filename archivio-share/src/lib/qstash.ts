import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
export const qstash = token ? new Client({ token }) : null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function scheduleCapsuleDelivery(
  capsuleId: string,
  deliverAt: number
): Promise<string | null> {
  const url = `${APP_URL.replace(/\/$/, "")}/api/capsule/send`;

  if (qstash) {
    const res = await qstash.publishJSON({
      url,
      body: { capsuleId },
      notBefore: deliverAt,
      retries: 5,
    });
    return res.messageId ?? null;
  }

  // Fallback: call the send endpoint directly after the delay
  const delayMs = Math.max(0, deliverAt * 1000 - Date.now());
  setTimeout(async () => {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capsuleId }),
      });
    } catch {
      console.error(`[qstash-fallback] Failed to deliver capsule ${capsuleId}`);
    }
  }, Math.min(delayMs, 2_147_483_647)); // setTimeout max safe value
  return `local-${capsuleId}`;
}
