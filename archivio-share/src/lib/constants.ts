export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const SHARE_SECRET = process.env.SHARE_SECRET ?? "";

export const DELIVERY_OPTIONS = {
  "1week": { label: "1 week", days: 7 },
  "3months": { label: "3 months", days: 90 },
  "6months": { label: "6 months", days: 180 },
  "1year": { label: "1 year", days: 365 },
  custom: { label: "Custom date", days: 0 },
} as const;

export const CAPSULE_MESSAGE_MAX_LENGTH = 500;
export const RATE_LIMIT_CAPSULES_PER_PHOTO = 3;
export const RATE_LIMIT_CAPSULES_PER_EMAIL_PER_DAY = 5;
export const RATE_LIMIT_EMAIL_SELF_PER_PHOTO_PER_HOUR = 3;
