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
    const main = document.querySelector("main")?.getBoundingClientRect();
    const header = document.querySelector("header")?.getBoundingClientRect();
    const composer = document.querySelector("form")?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      scrollY: window.scrollY,
      main,
      header,
      composer,
    };
  });

  assertOk(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: horizontal overflow`);
  assertOk(metrics.scrollHeight <= metrics.clientHeight + 1, `${label}: page should not scroll vertically`);
  assertOk(metrics.scrollY === 0, `${label}: page is scrolled`);
  assertOk(metrics.main && metrics.main.top >= -1, `${label}: app shell top is clipped`);
  assertOk(
    metrics.main && metrics.main.bottom >= metrics.innerHeight - 1 && metrics.main.bottom <= metrics.innerHeight + 1,
    `${label}: app shell does not fill viewport`
  );
  assertOk(metrics.header && metrics.header.top >= -1, `${label}: header is clipped`);
  assertOk(
    metrics.composer &&
      metrics.composer.top < metrics.innerHeight &&
      metrics.composer.bottom <= metrics.innerHeight + 1 &&
      metrics.composer.bottom >= metrics.innerHeight - 1,
    `${label}: composer is not pinned to the bottom`
  );

  await page.evaluate(() => window.scrollTo(0, 200));
  const scrollY = await page.evaluate(() => window.scrollY);
  assertOk(scrollY === 0, `${label}: app shell allowed page-level scroll`);
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
  const sessionsAfterChat = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/sessions");
    return response.json();
  });
  assertOk(Array.isArray(sessionsAfterChat) && sessionsAfterChat.length > 0, "session was not persisted");
  const sessionId = sessionsAfterChat[0].id;

  await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62|\u751f\u6210\u56fe\u5f62/ }).first().click();
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  const plotBox = await page.locator(".js-plotly-plot").boundingBox();
  assertOk(plotBox && plotBox.width > 400 && plotBox.height > 250, "desktop plot rendered too small");
  await assertViewportFit(page, "desktop plot");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-plot.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u653e\u5927/ }).click();
  await page.locator("text=\u653e\u5927\u67e5\u770b\u56fe\u5f62\u7ec6\u8282").waitFor({ timeout: 15000 });
  await page.locator(".js-plotly-plot").nth(1).waitFor({ timeout: 30000 });
  const modalPlotBox = await page.locator(".js-plotly-plot").nth(1).boundingBox();
  assertOk(modalPlotBox && modalPlotBox.width > 700 && modalPlotBox.height > 400, "modal plot rendered too small");
  await assertViewportFit(page, "desktop plot modal");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-plot-modal.jpg"), type: "jpeg", quality: 84 });
  await page.getByRole("button", { name: /\u5173\u95ed/ }).click();
  await page.locator("text=\u653e\u5927\u67e5\u770b\u56fe\u5f62\u7ec6\u8282").waitFor({ state: "detached", timeout: 15000 });

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Plot z = sin/ }).first().click();
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  assertOk((await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62/ }).count()) === 0, "history restored only a plot suggestion");
  await assertViewportFit(page, "desktop history plot");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-history-plot.jpg"), type: "jpeg", quality: 84 });

  const imagePath = path.join(screenshotDir, "qa-upload.png");
  fs.writeFileSync(
    imagePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );
  const messageCountBeforeOcrSend = await page.locator("article").count();
  await page.locator('input[type="file"]').setInputFiles(imagePath);
  await waitForText(page, /\u5df2\u8bc6\u522b\u4e3a\u53ef\u7f16\u8f91\u6587\u672c|\u6c42/, "desktop OCR result did not appear");
  const ocrTextarea = page.locator("textarea").first();
  assertOk((await page.locator("article").count()) === messageCountBeforeOcrSend, "OCR auto-submitted before user confirmation");
  assertOk((await ocrTextarea.inputValue()).includes("\\lim"), "OCR text was not copied into composer");
  await ocrTextarea.fill(`${String.fromCharCode(27714)} $\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}$`);
  const chatRequestPromise = page.waitForRequest((request) => request.url().includes("/chat/stream"));
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  const chatRequest = await chatRequestPromise;
  const chatPayload = JSON.parse(chatRequest.postData() || "{}");
  assertOk(
    typeof chatPayload.confirmed_ocr_text === "string" && chatPayload.confirmed_ocr_text.includes("\\lim"),
    "OCR-confirmed text was not sent through chat payload"
  );
  await waitForText(page, /\\lim|\u5939\u903c|\u7ed3\u8bba/, "desktop OCR-confirmed chat did not render");
  assertOk((await page.getByText(/\u5df2\u8bc6\u522b\u4e3a\u53ef\u7f16\u8f91\u6587\u672c/).count()) === 0, "OCR attachment did not clear after send");
  await assertNoRawDebugText(page);
  await assertViewportFit(page, "desktop OCR chat");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-ocr-chat.jpg"), type: "jpeg", quality: 84 });

  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/sessions/${sessionId}`) && response.request().method() === "DELETE"
  );
  await page.getByLabel(/\u5220\u9664\u4f1a\u8bdd/).first().click();
  const deleteResponse = await deleteResponsePromise;
  assertOk(deleteResponse.status() === 204, "session delete did not return 204");
  await page.getByText("\u5f00\u59cb\u4e00\u4e2a\u5b66\u4e60\u56de\u5408").waitFor({ timeout: 15000 });
  assertOk((await page.locator("article").count()) === 0, "deleted active session did not clear messages");
  await assertViewportFit(page, "desktop after delete");

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
  await page.getByLabel(/\u4e0a\u4f20\u56fe\u7247/).click();
  await assertViewportFit(page, "mobile composer image button");
  await page.screenshot({ path: path.join(screenshotDir, "mobile-composer.jpg"), type: "jpeg", quality: 84 });

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
