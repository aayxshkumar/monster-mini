export async function signUploadPayloadBrowser(
  secret: string,
  photoId: string,
  shortCode: string,
  timestamp: number
): Promise<string> {
  const payload = `${photoId}|${shortCode}|${timestamp}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(payload)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
