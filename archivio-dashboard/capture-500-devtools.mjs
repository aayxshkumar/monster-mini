#!/usr/bin/env node
/**
 * Launch browser with DevTools, capture 500 error, screenshot Network tab.
 * Run: node capture-500-devtools.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "verify-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--auto-open-devtools-for-tabs",
      "--window-size=1600,1000",
    ],
  });

  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  await page.goto("http://localhost:3000", {
    waitUntil: "networkidle",
    timeout: 20000,
  });

  await page.waitForTimeout(3000);

  // Screenshot - with DevTools open, this may capture the whole window including Network tab
  await page.screenshot({
    path: join(OUT_DIR, "network-tab-500-error.png"),
    fullPage: true,
  });

  console.log("Screenshot saved: network-tab-500-error.png");
  console.log("(If DevTools opened, the screenshot may show the Network tab)");

  await browser.close();
}

main().catch(console.error);
