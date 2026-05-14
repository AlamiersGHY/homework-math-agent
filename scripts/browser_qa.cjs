const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("../apps/web/node_modules/playwright");

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return fallback;
}

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertNoRawDebugText(page) {
  const bodyText = await page.locator("body").innerText();
  const forbidden = ["session_id", "metadata", "plot_suggestion", "LLM_API_KEY", "DOUBAO_API_KEY"];
  for (const token of forbidden) {
    assertOk(!bodyText.includes(token), `user-visible debug text leaked: ${token}`);
  }
}

async function assertViewportFit(page, label) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const header = document.querySelector("header")?.getBoundingClientRect();
    const composer = document.querySelector("form")?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      header,
      composer,
    };
  });

  assertOk(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: horizontal overflow`);
  assertOk(metrics.header && metrics.header.top >= -1, `${label}: header is clipped`);
  assertOk(
    metrics.composer &&
      metrics.composer.top < metrics.innerHeight &&
      metrics.composer.bottom <= metrics.innerHeight + 1,
    `${label}: composer is not fully visible`
  );
}

async function waitForText(page, regex, label) {
  await page.locator("body").filter({ hasText: regex }).waitFor({ timeout: 30000 });
  const text = await page.locator("body").innerText();
  assertOk(regex.test(text), label);
}

async function runDesktopFlow(browser, baseUrl, screenshotDir) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  await assertViewportFit(page, "desktop initial");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-initial.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u76f4\u63a5\u89e3\u7b54/ }).click();
  await page.locator("textarea").first().fill("Plot z = sin(x*y) as a 3D surface.");
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  await waitForText(page, /\u6ce2\u5cf0|\u66f2\u9762/, "desktop chat answer did not render");
  await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62|\u751f\u6210\u56fe\u5f62/ }).first().click();
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  const plotBox = await page.locator(".js-plotly-plot").boundingBox();
  assertOk(plotBox && plotBox.width > 400 && plotBox.height > 250, "desktop plot rendered too small");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-plot.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u56fe\u7247\u8bc6\u522b/ }).click();
  const imagePath = path.join(screenshotDir, "qa-upload.png");
  fs.writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );
  await page.locator('input[type="file"]').setInputFiles(imagePath);
  await waitForText(page, /\u5f53\u524d\u4f7f\u7528 mock OCR|\u6c42/, "desktop OCR result did not appear");
  const ocrTextarea = page.locator("textarea").first();
  await ocrTextarea.fill(`${String.fromCharCode(27714)} $\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}$`);
  await page.getByRole("button", { name: /\u786e\u8ba4\u5e76\u63d0\u95ee/ }).click();
  await waitForText(page, /\\lim|\u5939\u903c|\u7ed3\u8bba/, "desktop OCR-confirmed chat did not render");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-ocr-chat.jpg"), type: "jpeg", quality: 84 });

  await context.close();
}

async function runMobileFlow(browser, baseUrl, screenshotDir) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  await assertViewportFit(page, "mobile initial");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "mobile-initial.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u4ec5\u63d0\u793a/ }).click();
  await page.getByRole("button", { name: /\u56fe\u7247\u8bc6\u522b/ }).click();
  await assertViewportFit(page, "mobile image mode");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-image-mode.jpg"), type: "jpeg", quality: 84 });

  await context.close();
}

async function main() {
  const baseUrl = getArg("--url", "http://127.0.0.1:3011");
  const screenshotDir = path.resolve(getArg("--screenshots", path.join(".cache", "qa", "browser")));
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktopFlow(browser, baseUrl, screenshotDir);
    await runMobileFlow(browser, baseUrl, screenshotDir);
  } finally {
    await browser.close();
  }

  console.log(`Browser QA passed. Screenshots: ${screenshotDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
