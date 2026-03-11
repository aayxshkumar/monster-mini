#!/usr/bin/env node
/**
 * Verify login page at http://localhost:3001/login
 * - Forgot password? link
 * - Reset mode with "Enter your email and we'll send you a link..."
 * - Back to sign in link
 * Run: node verify-login.mjs
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

  const results = {};

  try {
    console.log("Navigating to http://localhost:3001/login...");
    await page.goto("http://localhost:3001/login", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);

    results.pageLoads = true;
    results.forgotPasswordLink = (await page.locator('button:has-text("Forgot password?")').count()) > 0;

    await page.screenshot({ path: join(OUT_DIR, "login-mode.png"), fullPage: true });
    console.log("Screenshot: login-mode.png");

    const forgotBtn = page.locator('button:has-text("Forgot password?")').first();
    if (await forgotBtn.count() > 0) {
      await forgotBtn.click();
      await page.waitForTimeout(600);
    }

    results.resetModeText = (await page.locator('text=Enter your email and we').count()) > 0;
    results.backToSignIn = (await page.locator('button:has-text("Back to sign in")').count()) > 0;

    await page.screenshot({ path: join(OUT_DIR, "reset-mode.png"), fullPage: true });
    console.log("Screenshot: reset-mode.png");

    results.consoleErrors = consoleErrors;
  } catch (err) {
    results.error = err.message;
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n--- Results ---");
  console.log(JSON.stringify(results, null, 2));
}

main();
