#!/usr/bin/env node
/**
 * Verify production login page at https://archivio-platform.vercel.app/login
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

  const results = {};

  try {
    console.log("Navigating to https://archivio-platform.vercel.app/login...");
    await page.goto("https://archivio-platform.vercel.app/login", {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);

    results.pageLoads = true;
    results.forgotPasswordLink = (await page.locator('button:has-text("Forgot password?")').count()) > 0;

    await page.screenshot({ path: join(OUT_DIR, "login-prod-mode.png"), fullPage: true });
    console.log("Screenshot: login-prod-mode.png");

    const forgotBtn = page.locator('button:has-text("Forgot password?")').first();
    if (await forgotBtn.count() > 0) {
      await forgotBtn.click();
      await page.waitForTimeout(800);
    }

    results.resetModeText = (await page.locator('text=Enter your email and we').count()) > 0;
    results.backToSignIn = (await page.locator('button:has-text("Back to sign in")').count()) > 0;

    await page.screenshot({ path: join(OUT_DIR, "login-prod-reset-mode.png"), fullPage: true });
    console.log("Screenshot saved: login-prod-reset-mode.png");
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
