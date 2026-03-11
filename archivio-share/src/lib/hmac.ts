import { createHmac, timingSafeEqual } from "crypto";

export function signUploadPayload(
  secret: string,
  photoId: string,
  shortCode: string,
  timestamp: number
): string {
  const payload = `${photoId}|${shortCode}|${timestamp}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyUploadSignature(
  secret: string,
  photoId: string,
  shortCode: string,
  timestamp: number,
  signature: string
): boolean {
  if (!secret || !signature) return false;
  const expected = signUploadPayload(secret, photoId, shortCode, timestamp);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
