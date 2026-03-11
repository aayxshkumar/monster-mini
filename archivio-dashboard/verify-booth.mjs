#!/usr/bin/env node
/**
 * Verify /booth page - welcome screen, Start button, printer status.
 * Run: node verify-booth.mjs
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
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("Navigating to http://localhost:3000/booth...");
  await page.goto("http://localhost:3000/booth", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);

  const results = {
    pageLoads: true,
    welcomeScreen: (await page.locator('text=Photo Booth').count()) > 0 ||
      (await page.locator('text=Take a photo, pick a style').count()) > 0,
    startButton: (await page.locator('button:has-text("Start")').count()) > 0,
    printerStatus: (await page.locator('text=Printer ready').count()) > 0 ||
      (await page.locator('text=Printer offline').count()) > 0,
    consoleErrors: [...consoleErrors],
  };

  await page.screenshot({ path: join(OUT_DIR, "booth-welcome.png"), fullPage: true });
  console.log("Screenshot saved: booth-welcome.png");

  await browser.close();

  console.log("\n--- Results ---");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
