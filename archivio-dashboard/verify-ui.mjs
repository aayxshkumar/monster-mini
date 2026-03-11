#!/usr/bin/env node
/**
 * Verify UI elements and capture screenshots for the dashboard and templates pages.
 * Run: node verify-ui.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "verify-screenshots");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error") consoleErrors.push({ type, text: msg.text(), location: msg.location() });
  });

  const results = { dashboard: {}, templates: {}, consoleErrors: [] };

  try {
    // 1. Dashboard page
    console.log("Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);

    const dashPath = join(OUT_DIR, "01-dashboard.png");
    await page.screenshot({ path: dashPath, fullPage: true });
    console.log("Step 1-2: Screenshot saved:", dashPath);

    // Scroll to center column so sliders are in view
    await page.locator('text=Live Preview').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    // Check for elements
    const templatesSection = await page.locator('text=Templates').first();
    const saveDesignBtn = await page.locator('button:has-text("Save Design")');
    const saveAsTemplateBtn = await page.locator('button:has-text("Save as Template")');
    const minHeightLabel = await page.locator('text=Min height');
    const printBufferLabel = await page.locator('text=Print buffer');
    const livePreview = await page.locator('text=Live Preview');
    const noTemplatesText = await page.locator('text=No templates saved yet');

    results.dashboard = {
      pageLoads: true,
      templatesSection: (await templatesSection.count()) > 0,
      templatesCardContent: (await noTemplatesText.count()) > 0 || (await saveDesignBtn.count()) > 0,
      saveDesignBtn: (await saveDesignBtn.count()) > 0,
      saveAsTemplateBtn: (await saveAsTemplateBtn.count()) > 0,
      minHeightSlider: (await minHeightLabel.count()) > 0,
      printBufferSlider: (await printBufferLabel.count()) > 0,
      livePreview: (await livePreview.count()) > 0,
      receiptCanvasPresent: (await page.locator('canvas').count()) > 0,
    };

    // Scroll down to show Templates and sliders
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    const dashPath2 = join(OUT_DIR, "02-dashboard-scrolled.png");
    await page.screenshot({ path: dashPath2, fullPage: true });
    console.log("Screenshot saved:", dashPath2);

    // 2. Templates page
    console.log("Navigating to http://localhost:3000/templates...");
    await page.goto("http://localhost:3000/templates", { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1500);

    const tmplPath = join(OUT_DIR, "03-templates.png");
    await page.screenshot({ path: tmplPath, fullPage: true });
    console.log("Screenshot saved:", tmplPath);

    await page.locator('text=Print Style').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    const printStyleCard = await page.locator('text=Print Style');
    const ditheringLabel = await page.locator('text=Dithering');
    const brightnessLabel = await page.locator('text=Brightness');
    const photoFilterLabel = await page.locator('text=Photo filter');
    const printerBufferLabel = await page.locator('text=Printer buffer');
    // BUFFER is drawn on Konva canvas - not a DOM element; verified via screenshot

    results.templates = {
      pageLoads: true,
      printStyleCard: (await printStyleCard.count()) > 0,
      dithering: (await ditheringLabel.count()) > 0,
      brightness: (await brightnessLabel.count()) > 0,
      photoFilter: (await photoFilterLabel.count()) > 0,
      printerBufferSlider: (await printerBufferLabel.count()) > 0,
      canvasPresent: (await page.locator('canvas').count()) > 0,
    };

    // Scroll to show Print Style card if needed
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const tmplPath2 = join(OUT_DIR, "04-templates-full.png");
    await page.screenshot({ path: tmplPath2, fullPage: true });
    console.log("Screenshot saved:", tmplPath2);

    results.consoleErrors = consoleErrors;
    console.log("\n--- Verification Results ---");
    console.log("Dashboard:", JSON.stringify(results.dashboard, null, 2));
    console.log("Templates:", JSON.stringify(results.templates, null, 2));
    if (consoleErrors.length > 0) {
      console.log("\nConsole errors:", consoleErrors.length);
      consoleErrors.forEach((e) => console.log("  -", e.text));
    } else {
      console.log("\nNo JS/console errors detected.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
