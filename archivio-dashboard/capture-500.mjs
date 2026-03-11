#!/usr/bin/env node
/**
 * Capture 500 errors from http://localhost:3000 - URL, response body, and screenshot.
 * Run: node capture-500.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "verify-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const failedRequests = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors"],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  page.on("response", async (response) => {
    const status = response.status();
    if (status >= 500) {
      const url = response.url();
      let body = "";
      try {
        body = await response.text();
      } catch {
        body = "(could not read body)";
      }
      failedRequests.push({ url, status, body });
    }
  });

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.waitForTimeout(2000);

  // Also trigger any lazy API calls (e.g. templates list)
  const apiCalls = await page.evaluate(() => {
    return new Promise((resolve) => {
      const origFetch = window.fetch;
      const calls = [];
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        if (res.status >= 500) {
          calls.push({
            url: args[0],
            status: res.status,
            body: await res.text().catch(() => ""),
          });
        }
        return res;
      };
      setTimeout(() => resolve(calls), 1500);
    });
  });

  console.log("\n--- 500 Error Report ---\n");
  if (failedRequests.length === 0 && (!apiCalls || apiCalls.length === 0)) {
    console.log("No 500 errors captured. The error may occur on a different request.");
    console.log("Checking for any failed requests...");
  }

  const all = [...failedRequests, ...(apiCalls || [])];
  for (const req of all) {
    console.log("URL:", req.url);
    console.log("Status:", req.status);
    console.log("Response body:", req.body || "(empty)");
    console.log("---");
  }

  if (all.length === 0) {
    // Try to find failed requests from performance/network
    const entries = await page.evaluate(() => {
      return performance.getEntriesByType("resource")
        .filter((e) => e.responseStatus >= 500)
        .map((e) => ({ url: e.name, status: e.responseStatus }));
    });
    if (entries.length > 0) {
      console.log("From performance entries:", entries);
    }
  }

  // Screenshot of the page (we can't easily screenshot DevTools Network tab in headless)
  await page.screenshot({ path: join(OUT_DIR, "page-with-500-context.png"), fullPage: true });
  console.log("\nScreenshot saved: page-with-500-context.png");

  await browser.close();

  if (all.length > 0) {
    console.log("\nFull URL of failing request:", all[0].url);
  }
}

main().catch(console.error);
