const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("../apps/web/node_modules/playwright");

const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjcKJcK1wrYKJSBXcml0dGVuIGJ5IE11UERGIDEuMjcuMgoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvSW5mbzw8L1Byb2R1Y2VyKE11UERGIDEuMjcuMik+Pj4+CmVuZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1s0IDAgUl0+PgplbmRvYmoKCjMgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1JvdGF0ZSAwL1Jlc291cmNlcyAzIDAgUi9QYXJlbnQgMiAwIFIvQ29udGVudHNbNiAwIFJdPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+PgplbmRvYmoKCjYgMCBvYmoKPDwvTGVuZ3RoIDE3NC9GaWx0ZXIvRmxhdGVEZWNvZGU+PgpzdHJlYW0KeNqNj7EOAiEQRHu+gj8QFtiRxFiY2NiZ0BmrO4iFFjZ+/82el9gaiiVvZh/Bvd2puegDT/QQDwTfXm736M+Pj+Lb8LdDzlpUtWrXisw5tEuXUIoRJgOiswRNlqyNjmJdVNKZ25Ek8c5cC6cZJzbjb4uOQWatqJNOEmD9umZGeSPLut8Mg+a4UvJslhm2m5C/bXYLBGo+MyDwjYK0UVrwzw/68d4u7tzc1S0uuUbhCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA0MiAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4gCjAwMDAwMDAxNzIgMDAwMDAgbiAKMDAwMDAwMDIxMyAwMDAwMCBuIAowMDAwMDAwMzIwIDAwMDAwIG4gCjAwMDAwMDA0MDkgMDAwMDAgbiAKCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFIvSURbPEMzQjlDM0FGMERDMzk4MEIxMUMyOUM2NUMyQTVDMzgzPjxDRTcwOEIxQzREOTgxQ0Y0RTU0QzdEQkJCRUU4REU3NT5dPj4Kc3RhcnR4cmVmCjY1MgolJUVPRgo=";

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  await page.waitForFunction(
    (source) => new RegExp(source).test(document.body.innerText),
    regex.source,
    { timeout: 30000 }
  );
  const text = await page.locator("body").innerText();
  assertOk(regex.test(text), label);
}

async function uploadSamplePdf(page) {
  const pdfBuffer = Buffer.from(SAMPLE_PDF_BASE64, "base64");
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
    name: "analysis-notes.pdf",
    mimeType: "application/pdf",
    buffer: pdfBuffer,
  });
}

function writeTinyPng(filePath) {
  fs.writeFileSync(
    filePath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );
}

async function runDocumentFailureFlow(browser, baseUrl, screenshotDir) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.route("**/documents", (route) => route.abort("failed"));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("Math Agent").waitFor({ timeout: 15000 });

  const bodyText = await page.locator("body").innerText();
  assertOk(!bodyText.includes("Failed to fetch"), "PDF document connection failure exposed raw Failed to fetch");
  assertOk(
    /PDF|材料|课程/.test(bodyText) && /连接|加载|读取|获取|失败|暂时无法/.test(bodyText),
    "PDF document connection failure did not show an actionable Chinese error"
  );

  const retryButton = page.getByRole("button", { name: /重试|重新加载|再试一次/ }).first();
  await retryButton.waitFor({ timeout: 15000 });
  await page.unroute("**/documents");
  await retryButton.click();
  await waitForText(page, /上传课程 PDF 后|PDF 材料|材料可被自动检索/, "PDF document retry did not recover");
  await assertViewportFit(page, "desktop document failure retry");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-document-failure-retry.jpg"), type: "jpeg", quality: 84 });

  await context.close();
}

async function runDesktopFlow(browser, baseUrl, screenshotDir) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  await assertViewportFit(page, "desktop initial");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-initial.jpg"), type: "jpeg", quality: 84 });

  await uploadSamplePdf(page);
  await waitForText(page, /analysis-notes\.pdf|\d+ \u4efd\u6750\u6599\u53ef\u88ab\u81ea\u52a8\u68c0\u7d22/, "desktop PDF material was not indexed");
  const documentList = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/documents");
    return response.json();
  });
  assertOk(Array.isArray(documentList) && documentList.length === 1, "uploaded PDF was not listed");
  assertOk(documentList[0].chunk_count >= 1, "uploaded PDF did not create chunks");
  await assertViewportFit(page, "desktop material upload");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-materials.jpg"), type: "jpeg", quality: 84 });

  await page.locator("textarea").first().fill("根据课本说明 uniform continuity definition");
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  await waitForText(page, /\u5f15\u7528\u6750\u6599/, "desktop citation panel did not render");
  await waitForText(page, /analysis-notes\.pdf/, "desktop citation filename did not render");
  const ragSessions = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/sessions");
    return response.json();
  });
  assertOk(Array.isArray(ragSessions) && ragSessions.length > 0, "RAG chat session was not persisted");
  const ragSessionId = ragSessions[0].id;
  const ragDetail = await page.evaluate(async (id) => {
    const response = await fetch(`http://127.0.0.1:8011/sessions/${id}`);
    return response.json();
  }, ragSessionId);
  const chatMetadata = ragDetail.artifacts.find((artifact) => artifact.artifact_type === "chat_metadata");
  assertOk(chatMetadata, "RAG chat metadata artifact was not persisted");
  assertOk(chatMetadata.payload.retrieval_attempted === true, "RAG metadata did not record retrieval_attempted");
  assertOk(Array.isArray(chatMetadata.payload.citations) && chatMetadata.payload.citations.length > 0, "RAG metadata did not persist citations");
  await assertViewportFit(page, "desktop citation answer");
  await assertNoRawDebugText(page);
  await page.screenshot({ path: path.join(screenshotDir, "desktop-citations.jpg"), type: "jpeg", quality: 84 });

  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /\u6839\u636e\u8bfe\u672c\u8bf4\u660e uniform continuity/ }).first().click();
  await waitForText(page, /\u5f15\u7528\u6750\u6599/, "history did not restore citation panel");
  await waitForText(page, /analysis-notes\.pdf/, "history did not restore citation filename");
  await assertViewportFit(page, "desktop history citations");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-history-citations.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u65b0\u5efa/ }).first().click();
  await page.locator("article").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
  await page.getByRole("button", { name: /\u76f4\u63a5\u89e3\u7b54/ }).click();
  await page.locator("textarea").first().fill("Visualize the implicit 3D surface x^2 + y^2 - z^2 = 1.");
  const automaticPlotRequestPromise = page.waitForRequest((request) => request.url().includes("/plots/preview"));
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  await waitForText(page, /\u6ce2\u5cf0|\u66f2\u9762/, "desktop chat answer did not render");
  const sessionsAfterChat = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/sessions");
    return response.json();
  });
  assertOk(Array.isArray(sessionsAfterChat) && sessionsAfterChat.length > 0, "session was not persisted");
  const sessionId = sessionsAfterChat[0].id;

  const automaticPlotRequest = await automaticPlotRequestPromise;
  const automaticPlotPayload = JSON.parse(automaticPlotRequest.postData() || "{}");
  assertOk(automaticPlotPayload.plot_type === "surface3d", "implicit 3D question did not request a surface3d plot");
  assertOk(
    typeof automaticPlotPayload.expression === "string" && !/sin\s*\(/i.test(automaticPlotPayload.expression),
    "implicit 3D question used a sin fallback expression"
  );
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  assertOk(
    (await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62|\u751f\u6210\u56fe\u5f62/ }).count()) === 0,
    "implicit 3D plot required a manual generate click"
  );
  const plotDetail = await page.evaluate(async (id) => {
    const response = await fetch(`http://127.0.0.1:8011/sessions/${id}`);
    return response.json();
  }, sessionId);
  const assistantMessage = plotDetail.messages.find((message) => message.role === "assistant");
  const plotArtifact = plotDetail.artifacts.find((artifact) => artifact.artifact_type === "plot_preview");
  assertOk(assistantMessage, "assistant message was not persisted");
  assertOk(plotArtifact && plotArtifact.message_id === assistantMessage.id, "plot artifact was not linked to assistant message id");
  assertOk(
    plotArtifact.payload?.plot?.plot_type === "surface3d" &&
      !/sin\s*\(/i.test(String(plotArtifact.payload?.plot?.expression ?? automaticPlotPayload.expression)),
    "persisted implicit 3D plot fell back to sin"
  );
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
  await page.getByRole("button", { name: /implicit 3D surface|x\^2 \+ y\^2/ }).first().click();
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  assertOk((await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62/ }).count()) === 0, "history restored only a plot suggestion");
  await assertViewportFit(page, "desktop history plot");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-history-plot.jpg"), type: "jpeg", quality: 84 });

  await page.getByRole("button", { name: /\u65b0\u5efa/ }).first().click();
  await page.locator("article").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);
  await page.locator("textarea").first().fill("Draw the graph of y = sin(x).");
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  await waitForText(page, /sin\(x\)|\u9898\u76ee\u662f|\u53ef\u89c6\u5316/, "desktop suggestion-only answer did not render");
  await page.locator("article").filter({ hasText: /\u6b63\u5728\u751f\u6210\u56de\u7b54/ }).waitFor({ state: "detached", timeout: 30000 }).catch(() => undefined);
  const suggestionOnlySessions = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/sessions");
    return response.json();
  });
  const suggestionSessionId = suggestionOnlySessions[0].id;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Math Agent").waitFor({ timeout: 15000 });
  const suggestionTitle = suggestionOnlySessions[0].title;
  await page.getByRole("button", { name: new RegExp(suggestionTitle.slice(0, 18).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62|\u751f\u6210\u56fe\u5f62/ }).first().waitFor({ timeout: 15000 });
  assertOk(
    (await page.locator(".js-plotly-plot").count()) === 0,
    "suggestion-only history unexpectedly restored a generated plot"
  );
  await page.getByRole("button", { name: /\u751f\u6210\u53ef\u89c6\u5316\u56fe\u5f62|\u751f\u6210\u56fe\u5f62/ }).first().click();
  await page.locator(".js-plotly-plot").waitFor({ timeout: 30000 });
  const suggestionDetail = await page.evaluate(async (id) => {
    const response = await fetch(`http://127.0.0.1:8011/sessions/${id}`);
    return response.json();
  }, suggestionSessionId);
  const suggestionAssistant = suggestionDetail.messages.find((message) => message.role === "assistant");
  const suggestionPlot = suggestionDetail.artifacts.find((artifact) => artifact.artifact_type === "plot_preview");
  assertOk(suggestionPlot && suggestionAssistant && suggestionPlot.message_id === suggestionAssistant.id, "restored suggestion did not persist plot against assistant message");
  await assertViewportFit(page, "desktop history suggestion");

  await page.getByRole("button", { name: /\u65b0\u5efa/ }).first().click();
  await page.locator("article").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => undefined);

  const firstImagePath = path.join(screenshotDir, "qa-attachment-a.png");
  const secondImagePath = path.join(screenshotDir, "qa-attachment-b.png");
  writeTinyPng(firstImagePath);
  writeTinyPng(secondImagePath);
  let ocrRequestCount = 0;
  await page.route("**/ocr/recognize", (route) => {
    ocrRequestCount += 1;
    route.continue();
  });
  const messageCountBeforeOcrSend = await page.locator("article").count();
  await page
    .locator('input[accept="image/png,image/jpeg,image/webp,image/gif"]')
    .setInputFiles([firstImagePath, secondImagePath]);
  const ocrTextarea = page.locator("textarea").first();
  await page.getByText("qa-attachment-a.png").waitFor({ timeout: 15000 });
  await page.getByText("qa-attachment-b.png").waitFor({ timeout: 15000 });
  assertOk((await page.locator('img[src^="blob:"], img[alt*="qa-attachment"]').count()) >= 2, "multi-image upload did not render thumbnail cards");
  await page.waitForTimeout(1000);
  assertOk(ocrRequestCount === 0, "OCR ran before the user clicked send");
  assertOk((await page.locator("article").count()) === messageCountBeforeOcrSend, "OCR auto-submitted before user confirmation");
  assertOk(!(await ocrTextarea.inputValue()).includes("\\lim"), "OCR text appeared in textarea before send");

  await page.getByText("qa-attachment-a.png").click();
  await page.getByRole("dialog").waitFor({ timeout: 15000 });
  await waitForText(page, /预览|勾画|标注|图片/, "image attachment preview/drawing modal did not open");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-image-preview-modal.jpg"), type: "jpeg", quality: 84 });
  await page.getByRole("button", { name: /关闭|完成|取消/ }).first().click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });

  await ocrTextarea.fill("请解这两张图片里的题");
  const ocrRequestAfterSendPromise = page.waitForRequest((request) => request.url().includes("/ocr/recognize"));
  const chatRequestPromise = page.waitForRequest((request) => request.url().includes("/chat/stream"));
  await page.getByRole("button", { name: /^\u53d1\u9001$/ }).click();
  await ocrRequestAfterSendPromise;
  const chatRequest = await chatRequestPromise;
  const chatPayload = JSON.parse(chatRequest.postData() || "{}");
  assertOk(ocrRequestCount >= 2, "send did not OCR every uploaded image");
  assertOk(
    typeof chatPayload.confirmed_ocr_text === "string" && chatPayload.confirmed_ocr_text.includes("\\lim"),
    "OCR-confirmed text was not sent through chat payload"
  );
  await waitForText(page, /\\lim|\u5939\u903c|\u7ed3\u8bba/, "desktop OCR-confirmed chat did not render");
  assertOk((await page.getByText(/qa-attachment-a\.png|qa-attachment-b\.png/).count()) === 0, "image attachments did not clear after send");
  await page.unroute("**/ocr/recognize");
  await assertNoRawDebugText(page);
  await assertViewportFit(page, "desktop OCR chat");
  await page.screenshot({ path: path.join(screenshotDir, "desktop-ocr-chat.jpg"), type: "jpeg", quality: 84 });

  const sessionsBeforeDelete = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8011/sessions");
    return response.json();
  });
  const activeDeleteId = sessionsBeforeDelete[0].id;
  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/sessions/${activeDeleteId}`) && response.request().method() === "DELETE"
  );
  await page.getByLabel(/\u5220\u9664\u4f1a\u8bdd/).first().click();
  const deleteResponse = await deleteResponsePromise;
  assertOk(deleteResponse.status() === 204, "session delete did not return 204");
  await page.getByText("\u65b0\u7684\u5b66\u4e60\u56de\u5408").waitFor({ timeout: 15000 });
  assertOk((await page.locator("article").count()) === 0, "deleted active session did not clear messages");
  await assertViewportFit(page, "desktop after delete");

  const deleteDocumentResponsePromise = page.waitForResponse(
    (response) => response.url().includes(`/documents/${documentList[0].id}`) && response.request().method() === "DELETE"
  );
  await page.getByLabel(new RegExp(`删除材料 ${escapeRegExp(documentList[0].filename)}`)).click();
  const deleteDocumentResponse = await deleteDocumentResponsePromise;
  assertOk(deleteDocumentResponse.status() === 204, "document delete did not return 204");
  await waitForText(page, /\u4e0a\u4f20\u8bfe\u7a0b PDF \u540e/, "material strip did not return to empty state");

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
    await runDocumentFailureFlow(browser, baseUrl, screenshotDir);
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
