import "dotenv/config";
import { db } from "../src/lib/db";
import { emailTemplates, events } from "../src/lib/schema";
import { nanoid } from "nanoid";

async function main() {
  const now = Math.floor(Date.now() / 1000);

  await db.insert(emailTemplates).values({
    id: nanoid(),
    name: "Default capsule",
    subject: "Your time capsule has arrived",
    heading: "Your time capsule has arrived",
    bodyHtml: "<p>Your photo and message are inside.</p>",
    footerText: "Archivio · Photobooth time capsules",
    previewText: "Your time capsule has arrived",
    eventId: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(events).values({
    id: nanoid(),
    name: "Sample Event",
    slug: "sample-event",
    date: new Date().toISOString().slice(0, 10),
    location: "Sample Location",
    organizer: "Archivio",
    branding: null,
    photoExpiryDays: 90,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log("Seed complete: default template and sample event added.");
}

main().catch(console.error);
