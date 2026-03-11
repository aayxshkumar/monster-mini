#!/usr/bin/env node
/**
 * Test dashboard and templates pages - report what we see.
 * Run: node test-pages.mjs
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
  const consoleErrors = [];
  const results = { dashboard: {}, templates: {}, errors: [] };

  try {
    // ─── 1. DASHBOARD (desktop viewport) ───
    const contextDesktop = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await contextDesktop.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    console.log("1. Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1200);

    results.dashboard = {
      pageLoads: true,
      hasPhotoBooth: (await page.locator('text=Photo Booth').count()) > 0,
      templatesCard: (await page.locator('text=Templates').count()) > 0,
      templatesShowsList: (await page.locator('text=No templates saved yet').count()) > 0 ||
        (await page.locator('[class*="ScrollArea"]').filter({ has: page.locator('text=Templates') }).count()) > 0 ||
        (await page.locator('button:has-text("Save Design")').count()) > 0,
      minHeightSlider: (await page.locator('text=Min height').count()) > 0,
      saveButton: (await page.locator('button:has-text("Save as Template")').count()) > 0 ||
        (await page.locator('button:has-text("Save Design")').count()) > 0,
      receiptCanvas: (await page.locator('canvas').count()) > 0,
    };

    await page.screenshot({ path: join(OUT_DIR, "01-dashboard-desktop.png"), fullPage: true });
    console.log("   Screenshot: 01-dashboard-desktop.png");

    // ─── Mobile viewport for bottom nav ───
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const hasMobileNav = (await page.locator('.fixed.bottom-0').count()) > 0 ||
      (await page.locator('nav, [role="navigation"]').filter({ hasText: /photo|templates|print|style/i }).count()) > 0;
    results.dashboard.mobileBottomNav = hasMobileNav;
    await page.screenshot({ path: join(OUT_DIR, "02-dashboard-mobile.png"), fullPage: true });
    console.log("   Screenshot: 02-dashboard-mobile.png");

    // ─── 2. TEMPLATES PAGE ───
    console.log("\n2. Navigating to http://localhost:3000/templates...");
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("http://localhost:3000/templates", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1200);

    results.templates = {
      pageLoads: true,
      templateEditor: (await page.locator('text=Template Editor').count()) > 0,
      canvasPresent: (await page.locator('canvas').count()) > 0,
      // "printer unprintable area" is drawn on canvas - not a DOM element; verify via screenshot
      propertiesPanel: (await page.locator('text=Properties').count()) > 0,
      // Check for W, H, X, Y numeric inputs - they should NOT exist
      hasWInput: (await page.locator('input[type="number"]').filter({ has: page.locator('.. >> text=/^W$|Width/') }).count()) > 0,
      hasHInput: (await page.locator('Label:has-text("W"), Label:has-text("H"), Label:has-text("X"), Label:has-text("Y")').count()) > 0,
    };

    // More specific check: look for number inputs with W/H/X/Y labels
    const numInputs = await page.locator('input[type="number"]').count();
    const labelsNearNumInputs = await page.locator('Label').allTextContents();
    const hasXYWHLabels = labelsNearNumInputs.some(t => /^\s*[Ww]\s*$|^\s*[Hh]\s*$|^\s*[Xx]\s*$|^\s*[Yy]\s*$/.test(t));
    results.templates.noXYWHInputs = !hasXYWHLabels;

    await page.screenshot({ path: join(OUT_DIR, "03-templates.png"), fullPage: true });
    console.log("   Screenshot: 03-templates.png");

    // Select an element to open properties panel, then check for W/H/X/Y
    const firstElement = await page.locator('canvas').first();
    if (await firstElement.count() > 0) {
      await firstElement.click({ position: { x: 100, y: 100 } });
      await page.waitForTimeout(400);
    }
    const propsText = await page.locator('[class*="Properties"]').first().textContent().catch(() => "");
    results.templates.propertiesContent = propsText?.includes("W") || propsText?.includes("X") || propsText?.includes("Y") || propsText?.includes("H ") ? "may have XYWH" : "no XYWH labels";

    await page.screenshot({ path: join(OUT_DIR, "04-templates-properties.png"), fullPage: true });
    console.log("   Screenshot: 04-templates-properties.png");

    results.errors = consoleErrors;
    await contextDesktop.close();
  } catch (err) {
    results.errors.push(err.message);
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }

  console.log("\n--- Results ---");
  console.log("Dashboard:", JSON.stringify(results.dashboard, null, 2));
  console.log("Templates:", JSON.stringify(results.templates, null, 2));
  if (results.errors.length > 0) {
    console.log("\nConsole/errors:", results.errors.length);
    results.errors.forEach((e) => console.log("  -", e));
  }
}

main();
