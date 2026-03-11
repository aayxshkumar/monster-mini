const SHARE_URL = process.env.SHARE_SERVICE_URL ?? "";
const SHARE_SECRET = process.env.SHARE_SECRET ?? "";

export async function syncCafeToShare(slug: string, name: string, logoUrl: string | null) {
  if (!SHARE_URL || !SHARE_SECRET) return;

  try {
    await fetch(`${SHARE_URL}/api/cafes/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SHARE_SECRET}`,
      },
      body: JSON.stringify({ slug, name, logoUrl }),
    });
  } catch {
    console.error(`Failed to sync cafe '${slug}' to share service`);
  }
}
