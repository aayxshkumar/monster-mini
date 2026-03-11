#!/usr/bin/env node
/**
 * Verify dashboard navbar: Templates, Gallery, Kiosk links.
 * Run: node verify-navbar.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "verify-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1500);

  const results = {
    pageLoads: true,
    templatesLink: (await page.locator('nav a:has-text("Templates"), nav button:has-text("Templates")').count()) > 0,
    galleryLink: (await page.locator('nav a:has-text("Gallery"), nav button:has-text("Gallery")').count()) > 0,
    kioskLink: (await page.locator('nav a:has-text("Kiosk"), nav button:has-text("Kiosk")').count()) > 0,
    consoleErrors: [...consoleErrors],
  };

  // Screenshot of full page
  await page.screenshot({ path: join(OUT_DIR, "navbar-full.png"), fullPage: true });

  // Screenshot of navbar area only
  const nav = page.locator("nav").first();
  if (await nav.count() > 0) {
    await nav.screenshot({ path: join(OUT_DIR, "navbar-area.png") });
    console.log("Screenshot saved: navbar-area.png");
  }
  console.log("Screenshot saved: navbar-full.png");

  await browser.close();

  console.log("\n--- Results ---");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
