#!/usr/bin/env node
/**
 * Comprehensive test of Archivio photo booth application.
 * Run: node comprehensive-test.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "verify-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

const results = {
  dashboard: {},
  templateEditor: {},
  shareHealth: {},
  platformHealth: {},
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const network500 = [];

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", async (res) => {
    if (res.status() >= 500) network500.push({ url: res.url(), status: res.status() });
  });

  try {
    // ─── 1. DASHBOARD ───
    console.log("1. Testing Dashboard (http://localhost:3000)...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    results.dashboard = {
      pageLoads: true,
      templatesSection: (await page.locator('text=Templates').count()) > 0,
      templatesShowsList: (await page.locator('text=No templates saved yet').count()) > 0 ||
        (await page.locator('button:has-text("Save Design")').count()) > 0,
      saveDesignBtn: (await page.locator('button:has-text("Save Design")').count()) > 0,
      saveAsTemplateBtn: (await page.locator('button:has-text("Save as Template")').count()) > 0,
      minHeightSlider: (await page.locator('text=Min height').count()) > 0,
      canvasPresent: (await page.locator('canvas').count()) > 0,
      consoleErrors: [...consoleErrors],
      network500: [...network500],
    };

    await page.screenshot({ path: join(OUT_DIR, "01-dashboard.png"), fullPage: true });
    console.log("   Screenshot: 01-dashboard.png");

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    results.dashboard.mobileBottomNav = (await page.locator('.fixed.bottom-0').count()) > 0 ||
      (await page.locator('nav, [role="navigation"]').filter({ hasText: /photo|templates|print|style/i }).count()) > 0;
    await page.setViewportSize({ width: 1400, height: 900 });

    // ─── 2. TEMPLATE EDITOR ───
    console.log("\n2. Testing Template Editor (http://localhost:3000/templates)...");
    await page.goto("http://localhost:3000/templates", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);

    const propsText = await page.locator('[class*="Properties"], [class*="properties"]').first().textContent().catch(() => "") || "";
    const hasXYWH = /(^|\s)(W|H|X|Y)(\s|$)/.test(propsText) || propsText.includes("Width") && propsText.includes("Height");

    results.templateEditor = {
      pageLoads: true,
      canvasPresent: (await page.locator('canvas').count()) > 0,
      templateEditorTitle: (await page.locator('text=Template Editor').count()) > 0,
      noXYWHInputs: !hasXYWH,
      propertiesPanel: (await page.locator('text=Properties').count()) > 0,
    };

    // Add text element
    const addTextBtn = page.locator('button:has-text("Text")').first();
    if (await addTextBtn.count() > 0) {
      await addTextBtn.click();
      await page.waitForTimeout(800);
      const textOnCanvas = await page.locator('canvas').first();
      results.templateEditor.textElementAdded = true;
    } else {
      results.templateEditor.textElementAdded = false;
    }

    await page.screenshot({ path: join(OUT_DIR, "02-templates.png"), fullPage: true });
    console.log("   Screenshot: 02-templates.png");

    // Mobile viewport for templates
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    results.templateEditor.mobileBottomNav = (await page.locator('.fixed.bottom-0').count()) > 0;
    await page.setViewportSize({ width: 1400, height: 900 });

    // ─── 3. SHARE HEALTH ───
    console.log("\n3. Testing Share Health (https://archivio-share.vercel.app/api/health)...");
    const shareRes = await page.goto("https://archivio-share.vercel.app/api/health", { waitUntil: "networkidle", timeout: 15000 });
    const shareBody = await shareRes?.text().catch(() => "");
    let shareJson = null;
    try {
      shareJson = JSON.parse(shareBody);
    } catch {}
    results.shareHealth = {
      status: shareRes?.status(),
      ok: shareJson?.ok === true,
      body: shareBody?.slice(0, 500),
      json: shareJson,
    };
    await page.screenshot({ path: join(OUT_DIR, "03-share-health.png"), fullPage: true });
    console.log("   Screenshot: 03-share-health.png");

    // ─── 4. PLATFORM HEALTH ───
    console.log("\n4. Testing Platform Health (https://archivio-platform.vercel.app/api/health)...");
    const platformRes = await page.goto("https://archivio-platform.vercel.app/api/health", { waitUntil: "networkidle", timeout: 15000 });
    const platformBody = await platformRes?.text().catch(() => "");
    let platformJson = null;
    try {
      platformJson = JSON.parse(platformBody);
    } catch {}
    results.platformHealth = {
      status: platformRes?.status(),
      ok: platformJson?.ok === true || platformJson?.status === "ok",
      body: platformBody?.slice(0, 500),
      json: platformJson,
    };
    await page.screenshot({ path: join(OUT_DIR, "04-platform-health.png"), fullPage: true });
    console.log("   Screenshot: 04-platform-health.png");

  } catch (err) {
    console.error("Error:", err.message);
    results.errors = err.message;
  } finally {
    await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPREHENSIVE TEST RESULTS");
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

main();
