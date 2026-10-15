import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import next from "next";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";

// Run explicitly after npm run build; uses the installed Chrome, with no screenshots.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = resolve(tmpdir());
const temporary = mkdtempSync(join(temporaryRoot, "tender-browser-"));
const app = next({ dev: false, dir: root });
let browser;
let socket;
let server;
let sequence = 0;
const pending = new Map();
const exceptions = [];
const requests = [];

async function waitFor(callback, description, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if (await callback()) return; } catch { /* Wait for navigation or state to finish. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${description}`);
}

function command(method, params = {}) {
  return new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { done, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function upload(selector, paths) {
  const document = await command("DOM.getDocument");
  const input = await command("DOM.querySelector", { nodeId: document.root.nodeId, selector });
  await command("DOM.setFileInputFiles", { nodeId: input.nodeId, files: paths });
}

async function choose(selector, filename) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const option = [...input.options].find(item => item.textContent === ${JSON.stringify(filename)});
    if (!option || option.disabled) throw new Error('Document option unavailable');
    input.value = option.value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function date(value, index = 0) {
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input[type="date"]')][${index}];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function contains(text) {
  return evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
}

function pageText(page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream)) : contents ? [contents] : [];
  const decoded = streams.map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join("\n");
  return [...decoded.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map((match) => Buffer.from(match[1], "hex").toString("latin1")).join("\n");
}

function unicodeMapText(document) {
  return document.getPages().flatMap((page) => {
    const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
    if (!fonts) return [];
    return fonts.entries().flatMap(([, reference]) => {
      const font = document.context.lookup(reference, PDFDict);
      const mapReference = font.get(PDFName.of("ToUnicode"));
      if (!mapReference) return [];
      const stream = document.context.lookup(mapReference, PDFRawStream);
      return [new TextDecoder().decode(decodePDFRawStream(stream).decode())];
    });
  }).join("\n");
}

async function runSmoke() {
try {
  await app.prepare();
  server = createServer(app.getRequestHandler());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const profile = join(temporary, "profile");
  const browserPath = process.env.TENDER_TEST_BROWSER ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  browser = spawn(browserPath, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => exceptions.push(error.message));
  let debuggingPort;
  await waitFor(() => { debuggingPort = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; return Boolean(debuggingPort); }, "Chrome startup");
  const targets = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await once(socket, "open");
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      clearTimeout(task.timer);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(JSON.stringify(message.error)));
      else task.done(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
    if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  });
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Network.enable");
  const downloads = join(temporary, "downloads");
  mkdirSync(downloads);
  await command("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await command("Page.navigate", { url: origin });
  await waitFor(() => contains("Your checklist starts here"), "initial empty state");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#tender-input'"), "initial Tender navigation state");
  await evaluate("window.location.hash = '#%'");
  await waitFor(() => evaluate("window.location.hash === '#%'"), "malformed external hash is tolerated");
  assert.equal(await evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#tender-input'"), true, "malformed hash keeps navigation usable");
  await evaluate("document.querySelector('nav a[href=\\\"#documents-input\\\"]').click()");
  await waitFor(() => evaluate("window.location.hash === '#documents-input'"), "documents navigation hash");
  await waitFor(() => evaluate("document.querySelector('#documents-input').getBoundingClientRect().top > -100 && document.querySelector('#documents-input').getBoundingClientRect().top < 132"), "initial Documents anchor scroll settles");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#documents-input'"), "active workflow item follows hash navigation");
  assert.equal(await evaluate("document.querySelector('nav a[aria-current=step]').getAttribute('href')"), "#documents-input", "active workflow item follows hash navigation");
  await evaluate("document.querySelector('nav a[href=\\\"#tender-input\\\"]').click()");
  await waitFor(() => evaluate("window.location.hash === '#tender-input'"), "Tender navigation hash");
  await waitFor(() => evaluate("document.querySelector('#tender-input').getBoundingClientRect().top > -100 && document.querySelector('#tender-input').getBoundingClientRect().top < 132"), "Tender anchor scroll settles");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#tender-input'"), "sidebar can navigate back to Tender");
  await evaluate("document.querySelector('nav a[href=\\\"#documents-input\\\"]').click()");
  await waitFor(() => evaluate("document.querySelector('#documents-input').getBoundingClientRect().top > -100 && document.querySelector('#documents-input').getBoundingClientRect().top < 132"), "Documents anchor scroll settles");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#documents-input'"), "sidebar can navigate forward to Documents");
  await evaluate("history.back()");
  await waitFor(() => evaluate("window.location.hash === '#tender-input'"), "browser Back restores Tender hash");
  await waitFor(() => evaluate("document.querySelector('#tender-input').getBoundingClientRect().top > -100 && document.querySelector('#tender-input').getBoundingClientRect().top < 132"), "browser Back restores Tender scroll position");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#tender-input'"), "browser Back restores active workflow item");
  await evaluate("history.forward()");
  await waitFor(() => evaluate("window.location.hash === '#documents-input'"), "browser Forward restores Documents hash");
  await waitFor(() => evaluate("document.querySelector('#documents-input').getBoundingClientRect().top > -100 && document.querySelector('#documents-input').getBoundingClientRect().top < 132"), "browser Forward restores Documents scroll position");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#documents-input'"), "browser Forward restores active workflow item");
  await evaluate("window.scrollTo(0, document.querySelector('#checklist-section').getBoundingClientRect().top + window.scrollY + 24)");
  await waitFor(() => evaluate("document.querySelector('#checklist-section').getBoundingClientRect().top <= 132"), "manual scroll reaches the checklist section");
  const manualScrollState = await evaluate("JSON.stringify({ active: document.querySelector('nav a[aria-current=step]')?.getAttribute('href'), scrollY: window.scrollY, checklistTop: document.querySelector('#checklist-section').getBoundingClientRect().top })");
  assert.equal(JSON.parse(manualScrollState).active, "#checklist-section", `manual scrolling updates active workflow item: ${manualScrollState}`);
  assert.equal(await evaluate("window.location.hash === '#documents-input'"), true, "manual scrolling does not rewrite the URL hash");
  await command("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('nav a[href=\\\"#readiness-section\\\"]').click()");
  await waitFor(() => evaluate("document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#readiness-section'"), "mobile workflow navigation updates active item");
  await command("Emulation.setDeviceMetricsOverride", { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('nav a[href=\\\"#documents-input\\\"]').click()");
  await waitFor(() => evaluate("window.location.hash === '#documents-input'"), "desktop Documents hash restored");
  await waitFor(() => evaluate("document.querySelector('#documents-input').getBoundingClientRect().top > -100 && document.querySelector('#documents-input').getBoundingClientRect().top < 132"), "desktop Documents anchor scroll settles");
  const desktopNavigationState = await evaluate("JSON.stringify({ active: document.querySelector('nav a[aria-current=step]')?.getAttribute('href'), hash: window.location.hash, tops: ['tender-input', 'documents-input', 'checklist-section', 'readiness-section', 'generation-panel'].map(id => [id, document.querySelector('#' + id).getBoundingClientRect().top]) })");
  assert.equal(JSON.parse(desktopNavigationState).active, "#documents-input", `restore document section before reload: ${desktopNavigationState}`);
  await command("Page.reload");
  await waitFor(() => evaluate("window.location.hash === '#documents-input' && document.querySelector('nav a[aria-current=step]')?.getAttribute('href') === '#documents-input'"), "reload with a section hash restores active navigation");
  assert.ok(["light", "dark"].includes(await evaluate("document.documentElement.dataset.theme")), "system preference resolves to a supported theme");
  assert.equal(await evaluate("document.querySelector('#theme-toggle').getAttribute('aria-label') !== null"), true, "theme control has an accessible name");
  assert.equal(await evaluate("document.querySelector('a[href=\"#main\"]') !== null"), true, "skip link is present");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].every(button => Boolean(button.getAttribute('aria-label') || button.textContent.trim()))"), true, "all buttons have accessible names");
  assert.equal(await evaluate("[...document.querySelectorAll('select, input[type=date]')].every(input => input.labels.length > 0)"), true, "document controls have labels");
  await evaluate("document.activeElement.blur(); document.body.setAttribute('tabindex', '-1'); document.body.focus()");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"), true, "keyboard focus is visibly indicated");
  assert.equal(await evaluate("document.activeElement.matches('a[href=\\\"#main\\\"]')"), true, "skip link is first in keyboard order");
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await waitFor(() => evaluate("document.activeElement.id === 'main'"), "keyboard activates the skip link");
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "auto", "reduced motion disables smooth page scrolling");
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await evaluate("document.querySelector('#theme-toggle').click()");
  const persistedTheme = await evaluate("document.documentElement.dataset.theme");
  assert.equal(await evaluate("localStorage.getItem('tender-package-theme') === document.documentElement.dataset.theme"), true, "theme selection is persisted");
  await command("Page.reload");
  await waitFor(() => evaluate(`document.documentElement.dataset.theme === ${JSON.stringify(persistedTheme)} && Boolean(document.querySelector('#generate-package'))`), "theme survives reload without hydration errors");
  await evaluate("document.querySelector('#theme-toggle').click()");
  assert.notEqual(await evaluate("document.documentElement.dataset.theme"), persistedTheme, "theme control switches between light and dark");
  await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'বাংলা').click()");
  await waitFor(() => contains("নথির কর্মক্ষেত্র"), "React hydration and Bangla toggle");
  await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'EN').click()");

  const invalidJson = join(temporary, "invalid.json");
  writeFileSync(invalidJson, "{invalid");
  await upload("#json-upload", [invalidJson]);
  await waitFor(() => contains("malformed JSON"), "malformed JSON error");
  await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'বাংলা').click()");
  await waitFor(() => contains("এই ফাইলের JSON বিন্যাস সঠিক নয়"), "validation error follows language switch");
  await evaluate("[...document.querySelectorAll('button')].find(button => button.textContent === 'EN').click()");

  const json = join(temporary, "unseen.json");
  writeFileSync(json, JSON.stringify({
    tender: { tender_id: "UNSEEN-TEST", title: "Browser check", procuring_entity: "Test entity", bidder: "Test bidder", submission_deadline: "2026-10-20" },
    requirements: [
      { id: "optional", order: 3, title_en: "Optional document", title_bn: "ঐচ্ছিক নথি", mandatory: false, has_expiry: false },
      { id: "required", order: 2, title_en: "Required document", title_bn: "আবশ্যক নথি", mandatory: true, has_expiry: false },
      { id: "expiry", order: 1, title_en: "Expiring document", title_bn: "মেয়াদের নথি", mandatory: true, has_expiry: true },
      { id: "optional-expiry", order: 4, title_en: "Optional expiring document", title_bn: "মেয়াদযুক্ত ঐচ্ছিক নথি", mandatory: false, has_expiry: true },
    ],
  }));
  await upload("#json-upload", [json]);
  await waitFor(() => contains("UNSEEN-TEST"), "valid unseen JSON");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('ol > li h3')].map(item => item.textContent)"), ["Expiring document", "Required document", "Optional document", "Optional expiring document"]);
  assert.equal(await contains("Not provided"), true);
  assert.deepEqual(await evaluate("['total', 'ok', 'blocking', 'not-provided'].map(key => document.querySelector('#readiness-' + key).textContent)"), ["4", "0", "2", "2"]);
  assert.equal(await contains("Resolve 2 blocking issues"), true);
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);

  const corrupt = join(temporary, "damaged.pdf");
  writeFileSync(corrupt, "%PDF-1.7\ncorrupt");
  await upload("#pdf-upload", ["experience_cert.pdf", "experience_cert (1).pdf", "03_tin_certificate.pdf", "trade_license_2026.pdf", "company_logo.png"].map((filename) => join(root, "documents", filename)).concat(corrupt));
  await waitFor(() => contains("Some files could not be added"), "mixed PDF batch");
  assert.equal(await evaluate("[...document.querySelectorAll('span')].filter(item => item.textContent === 'Duplicate').length"), 2);
  assert.equal(await contains("Only PDF files are accepted"), true);
  assert.equal(await contains("damaged or unreadable"), true);

  await choose("#requirement-0", "trade_license_2026.pdf");
  await waitFor(() => contains("Expiry date needed"), "expiry needed state");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);
  await date("2026-10-19");
  await waitFor(() => contains("Expired"), "expiry before deadline");
  await date("2026-10-20");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true, "unmatched mandatory document still blocks");
  await choose("#requirement-1", "experience_cert.pdf");
  await waitFor(() => contains("Requirements complete"), "expiry exactly on deadline and optional unmatched readiness");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), false);
  assert.deepEqual(await evaluate("['total', 'ok', 'blocking', 'not-provided'].map(key => document.querySelector('#readiness-' + key).textContent)"), ["4", "2", "0", "2"]);
  await date("2026-10-21");
  await waitFor(() => contains("All required documents are ready"), "expiry after deadline remains ready");
  assert.equal(await evaluate("[...document.querySelector('#requirement-2').options].find(item => item.textContent.includes('experience_cert (1).pdf')).disabled"), true);
  assert.equal(await evaluate("[...document.querySelector('#requirement-2').options].find(item => item.textContent.startsWith('experience_cert.pdf')).disabled"), true, "same file disabled in another row");
  assert.equal(await contains("Only one copy can be assigned"), true);

  await evaluate("document.querySelector('[aria-label=\"Remove match: Required document\"]').click()");
  await waitFor(() => evaluate("document.querySelector('#generate-package').disabled"), "unmatching immediately blocks generation");
  assert.equal(await evaluate("[...document.querySelector('#requirement-2').options].find(item => item.textContent === 'experience_cert (1).pdf').disabled"), false);
  await choose("#requirement-2", "experience_cert (1).pdf");
  await evaluate("document.querySelector('[aria-label=\"Remove match: Optional document\"]').click()");
  await waitFor(() => evaluate("document.querySelector('#requirement-2').value === ''"), "explicit optional unmatch");
  await choose("#requirement-1", "experience_cert.pdf");
  await waitFor(() => evaluate("!document.querySelector('#generate-package').disabled"), "freed hash can be reassigned");

  await choose("#requirement-0", "03_tin_certificate.pdf");
  await waitFor(() => contains("Expiry date needed"), "changing the match resets expiry");
  assert.equal(await evaluate("document.querySelector('input[type=date]').value"), "");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);
  await date("2026-10-20");
  await choose("#requirement-0", "trade_license_2026.pdf");
  await waitFor(() => evaluate("document.querySelector('input[type=date]').value === ''"), "second replacement also resets expiry");
  await date("2026-10-20");
  await waitFor(() => evaluate("!document.querySelector('#generate-package').disabled"), "mandatory issues resolved again");

  await choose("#requirement-3", "03_tin_certificate.pdf");
  await waitFor(() => evaluate("document.querySelector('#generate-package').disabled"), "matched optional document with missing expiry blocks");
  assert.equal(await contains("Resolve 1 blocking issue"), true);
  await evaluate("document.querySelector('[aria-label=\"Remove match: Optional expiring document\"]').click()");
  await waitFor(() => evaluate("!document.querySelector('#generate-package').disabled"), "unmatched optional expiry document is non-blocking");
  assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 1);

  for (const language of ["en", "bn"]) {
    await evaluate(`document.querySelector('button[lang="${language}"]').click()`);
    await waitFor(() => evaluate(`document.querySelector('div[lang="${language}"]') !== null`), "language update");
    if (language === "bn") {
      assert.equal(await contains("মেয়াদের নথি"), true);
      assert.equal(await contains("সব আবশ্যক নথি প্রস্তুত"), true);
      assert.equal(await evaluate("document.querySelector('#readiness-ok').textContent"), "২");
      assert.equal(await contains("Test bidder"), true, "tender-provided names remain unchanged");
      await evaluate(`(() => {
        window.__tenderObjectUrls = { created: [], revoked: [] };
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); window.__tenderObjectUrls.created.push(url); return url; };
        URL.revokeObjectURL = url => { window.__tenderObjectUrls.revoked.push(url); revoke(url); };
      })()`);
      await command("Network.setBlockedURLs", { urls: ["*NotoSansBengali.ttf*"] });
      await evaluate("document.querySelector('#generate-package').click()");
      await waitFor(() => contains("ইউনিকোড প্রচ্ছদ ফন্ট লোড করা যায়নি"), "font load failure is localized and recoverable");
      assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), false, "font failure does not leave generation stuck");
      await command("Network.setBlockedURLs", { urls: [] });
      const loadingVisible = await evaluate(`(async () => {
        const button = document.querySelector('#generate-package');
        button.click();
        button.click();
        await new Promise(done => setTimeout(done, 0));
        return button.disabled && button.getAttribute('aria-busy') === 'true';
      })()`);
      assert.equal(loadingVisible, true, "generation loading state disables repeat clicks");
      const downloaded = join(downloads, "UNSEEN-TEST_Package.pdf");
      await waitFor(() => existsSync(downloaded), "PDF downloaded with the exact filename");
      await waitFor(() => contains("ডাউনলোড শুরু হয়েছে"), "translated generation success");
      const output = await PDFDocument.load(readFileSync(downloaded));
      const trade = await PDFDocument.load(readFileSync(join(root, "documents", "trade_license_2026.pdf")));
      const experience = await PDFDocument.load(readFileSync(join(root, "documents", "experience_cert.pdf")));
      const total = 1 + trade.getPageCount() + experience.getPageCount();
      assert.equal(output.getPageCount(), total);
      const cover = pageText(output.getPage(0));
      assert.ok(cover.includes("Tender Document Package"), "cover remains English in Bangla UI");
      assert.ok(cover.includes("1. Expiring document"));
      assert.ok(cover.includes("2. Required document"));
      assert.ok(!cover.includes("3. Optional document"));
      assert.ok(cover.includes("Test bidder"));
      for (const [index, page] of output.getPages().entries()) assert.ok(pageText(page).includes(`UNSEEN-TEST | Page ${index + 1} of ${total}`));
      await waitFor(() => evaluate("window.__tenderObjectUrls.created.length === 1 && window.__tenderObjectUrls.revoked.length === 1"), "download object URL released");
      assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), false, "generation can be repeated after success");
    }
    for (const width of [320, 375, 768, 1024, 1280, 1440]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `${language} layout overflow at ${width}px`);
      assert.equal(await evaluate("[...document.querySelectorAll('select, input[type=date]')].every(input => input.getBoundingClientRect().width > 120 && input.getBoundingClientRect().height >= 40)"), true, `${language} controls unusable at ${width}px`);
      assert.equal(await evaluate("[...document.querySelectorAll('header, nav, .panel, .requirement-row, .field, .nav-step, .status-badge')].every(item => { const rect = item.getBoundingClientRect(); return rect.left >= -1 && rect.right <= window.innerWidth + 1; })"), true, `${language} workspace elements overflow at ${width}px`);
    }
  }
  await evaluate("document.querySelector('button[lang=en]').click()");
  await waitFor(() => contains("All required documents are ready"), "English restored");

  const unicodeTender = JSON.parse(readFileSync(json, "utf8"));
  unicodeTender.tender.tender_id = "BANGLA-UNICODE-TEST";
  unicodeTender.tender.title = "আইটি সরঞ্জাম সরবরাহ";
  unicodeTender.tender.procuring_entity = "তথ্য প্রযুক্তি অধিদপ্তর";
  unicodeTender.tender.bidder = "মেঘনা টেক সল্যুশনস লিমিটেড";
  const unicodeJsonPath = join(temporary, "unicode-tender.json");
  writeFileSync(unicodeJsonPath, JSON.stringify(unicodeTender));
  await upload("#json-upload", [unicodeJsonPath]);
  await waitFor(() => contains("BANGLA-UNICODE-TEST"), "Bangla tender metadata loaded");
  await choose("#requirement-0", "trade_license_2026.pdf");
  await date("2026-10-20");
  await choose("#requirement-1", "experience_cert.pdf");
  await waitFor(() => evaluate("!document.querySelector('#generate-package').disabled"), "Bangla tender ready for generation");
  await evaluate("document.querySelector('button[lang=bn]').click()");
  await waitFor(() => contains("সব আবশ্যক নথি প্রস্তুত"), "Bangla interface remains active for Unicode package");
  await evaluate("document.querySelector('#generate-package').click()");
  const unicodeDownload = join(downloads, "BANGLA-UNICODE-TEST_Package.pdf");
  await waitFor(() => existsSync(unicodeDownload), "Bangla tender package downloaded with exact filename");
  await waitFor(() => contains("ডাউনলোড শুরু হয়েছে"), "Unicode package download success announced");
  const unicodeOutput = await PDFDocument.load(readFileSync(unicodeDownload));
  const unicodeValues = [unicodeTender.tender.title, unicodeTender.tender.procuring_entity, unicodeTender.tender.bidder];
  assert.equal(unicodeOutput.getTitle(), "BANGLA-UNICODE-TEST - Tender Document Package");
  assert.equal(unicodeOutput.getAuthor(), unicodeTender.tender.bidder);
  assert.equal(unicodeOutput.getSubject(), unicodeTender.tender.title);
  assert.equal(unicodeOutput.getPageCount(), 1 + (await PDFDocument.load(readFileSync(join(root, "documents", "trade_license_2026.pdf")))).getPageCount() + (await PDFDocument.load(readFileSync(join(root, "documents", "experience_cert.pdf")))).getPageCount());
  const unicodeMaps = unicodeMapText(unicodeOutput);
  for (const character of unicodeValues.join("")) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && !/[\s\r\n\t]/.test(character)) assert.ok(unicodeMaps.includes(codePoint.toString(16).padStart(4, "0").toUpperCase()), `PDF font maps ${character}`);
  }
  const unicodeCover = pageText(unicodeOutput.getPage(0));
  for (const label of ["Tender ID", "Tender title", "Procuring entity", "Bidder name", "Submission deadline", "Date package was made", "Included documents"]) assert.ok(unicodeCover.includes(label), `English cover includes ${label}`);
  for (const [index, page] of unicodeOutput.getPages().entries()) assert.ok(pageText(page).includes(`BANGLA-UNICODE-TEST | Page ${index + 1} of ${unicodeOutput.getPageCount()}`));
  await waitFor(() => evaluate("window.__tenderObjectUrls.created.length === 2 && window.__tenderObjectUrls.revoked.length === 2"), "Unicode download object URL released");
  await evaluate("document.querySelector('button[lang=en]').click()");
  await waitFor(() => contains("All required documents are ready"), "return to English before the official sample workflow");
  const sampleExtras = ["04_vat_certificate.pdf", "bank_solvency.pdf", "02_technical_proposal.pdf", "01_financial_proposal.pdf", "scan_0042.pdf", "trade_license_2025.pdf"];
  await upload("#pdf-upload", sampleExtras.map((filename) => join(root, "documents", filename)));
  await waitFor(() => evaluate(`${JSON.stringify(sampleExtras)}.every(filename => document.body.innerText.includes(filename))`), "all remaining sample PDFs uploaded");
  const retainedFileCount = await evaluate("document.querySelectorAll('button[aria-label^=\\\"Remove: \\\"]').length");
  await upload("#json-upload", [join(root, "requirements.json")]);
  await waitFor(() => contains("T-2026-0417"), "load the official sample tender over the Unicode tender");
  await waitFor(() => evaluate("document.querySelectorAll('.requirement-row').length === 10 && [...document.querySelectorAll('.requirement-row select')].every(select => select.value === '')"), "new tender clears old assignments");
  assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 0, "new tender clears old expiry values");
  assert.equal(await evaluate("document.querySelectorAll('button[aria-label^=\\\"Remove: \\\"]').length"), retainedFileCount, "uploaded PDFs intentionally remain available across tenders");
  assert.deepEqual(await evaluate("['total', 'ok', 'blocking', 'not-provided'].map(key => document.querySelector('#readiness-' + key).textContent)"), ["10", "0", "8", "2"]);

  const sampleAssignments = [
    [0, "trade_license_2026.pdf"], [1, "03_tin_certificate.pdf"], [2, "04_vat_certificate.pdf"],
    [3, "bank_solvency.pdf"], [4, "experience_cert.pdf"], [7, "02_technical_proposal.pdf"],
    [8, "01_financial_proposal.pdf"], [9, "scan_0042.pdf"],
  ];
  for (const [index, filename] of sampleAssignments) await choose(`#requirement-${index}`, filename);
  await date("2027-06-30", 0);
  await date("2026-12-31", 1);
  await waitFor(() => evaluate("[...document.querySelectorAll('.requirement-row')].every((row, index) => row.dataset.status === ([0,1,2,3,4,7,8,9].includes(index) ? 'OK' : 'NOT_PROVIDED'))"), "official sample statuses match expected results");
  assert.deepEqual(await evaluate("['total', 'ok', 'blocking', 'not-provided'].map(key => document.querySelector('#readiness-' + key).textContent)"), ["10", "8", "0", "2"]);
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), false, "official sample package becomes ready");
  await evaluate("document.querySelector('#generate-package').click()");
  const sampleDownload = join(downloads, "T-2026-0417_Package.pdf");
  await waitFor(() => existsSync(sampleDownload), "official sample package downloaded with required filename");
  await waitFor(() => evaluate("window.__tenderObjectUrls.created.length === 3 && window.__tenderObjectUrls.revoked.length === 3"), "sample download object URL released");
  const sampleOutput = await PDFDocument.load(readFileSync(sampleDownload));
  const includedSampleFiles = sampleAssignments.map(([, filename]) => filename);
  const expectedSamplePages = 1 + (await Promise.all(includedSampleFiles.map(async (filename) => (await PDFDocument.load(readFileSync(join(root, "documents", filename)))).getPageCount()))).reduce((sum, count) => sum + count, 0);
  assert.equal(sampleOutput.getPageCount(), expectedSamplePages);
  const sampleCover = pageText(sampleOutput.getPage(0));
  const orderedTitles = ["Trade License", "TIN Certificate", "VAT Registration Certificate", "Bank Solvency Certificate", "Experience Certificate", "Technical Proposal", "Financial Proposal", "Signed Declaration"];
  for (const title of orderedTitles) assert.ok(sampleCover.includes(title), `sample cover includes ${title}`);
  assert.ok(!sampleCover.includes("Audited Financial Statement"));
  assert.ok(!sampleCover.includes("Manufacturer's Authorization"));
  for (const [index, page] of sampleOutput.getPages().entries()) assert.ok(pageText(page).includes(`T-2026-0417 | Page ${index + 1} of ${expectedSamplePages}`));

  await choose("#requirement-0", "trade_license_2025.pdf");
  await date("2025-06-30", 0);
  await waitFor(() => evaluate("document.querySelector('#requirement-0').closest('.requirement-row').dataset.status === 'EXPIRED'"), "expired sample license blocks package");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);
  await choose("#requirement-0", "trade_license_2026.pdf");
  assert.equal(await evaluate("document.querySelector('input[type=date]').value"), "", "changing the license clears its old expiry");
  await date("2027-06-30", 0);
  await waitFor(() => evaluate("!document.querySelector('#generate-package').disabled"), "valid replacement license restores readiness");

  await evaluate("document.querySelector('[aria-label=\"Remove: trade_license_2026.pdf\"]').click()");
  await waitFor(() => evaluate("document.querySelector('#requirement-0').closest('.requirement-row').dataset.status === 'MISSING'"), "removing a matched sample file invalidates readiness");
  assert.equal(await evaluate("document.querySelectorAll('input[type=date]').length"), 1, "unrelated R04 expiry remains assigned");
  assert.equal(await evaluate("document.querySelector('#generate-package').disabled"), true);
  await evaluate("document.querySelector('[aria-label=\"Remove: experience_cert (1).pdf\"]').click()");
  await waitFor(async () => (await evaluate("[...document.querySelectorAll('span')].filter(item => item.textContent === 'Duplicate').length")) === 0, "duplicate indicator clears");
  const longName = `Long supporting tender document ${"with a deliberately long safe filename ".repeat(4)}.pdf`;
  const longPath = join(temporary, longName);
  const longPdf = await PDFDocument.create();
  longPdf.addPage();
  writeFileSync(longPath, await longPdf.save());
  await upload("#pdf-upload", [longPath]);
  await waitFor(() => contains(longName), "long filename is available in file details");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, "long filename does not cause horizontal overflow");
  assert.equal(await evaluate(`[...document.querySelectorAll('li')].some(item => item.textContent.includes(${JSON.stringify(longName)}) && item.getBoundingClientRect().right <= window.innerWidth + 1)`), true, "long filename remains within its uploaded-file row");
  assert.deepEqual(exceptions, [], "browser runtime errors");
  assert.equal(requests.every((url) => url.startsWith(origin) || url.startsWith("data:") || url.startsWith(`blob:${origin}/`)), true, "document workflow sent an external request");
} finally {
  const browserExited = browser && browser.exitCode === null ? once(browser, "exit").then(() => true) : Promise.resolve(true);
  if (socket?.readyState === WebSocket.OPEN) {
    try { await command("Browser.close"); } catch { /* Browser may close before responding. */ }
    socket.close();
  }
  if (browser && browser.exitCode === null) {
    // Let Chrome release its profile before terminating the owned process.
    const exited = await Promise.race([browserExited, new Promise((done) => setTimeout(() => done(false), 5000).unref())]);
    if (!exited) {
      browser.kill();
      await Promise.race([browserExited, new Promise((done) => setTimeout(done, 2000).unref())]);
    }
  }
  if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  await app.close();
  if (!resolve(temporary).startsWith(temporaryRoot + sep)) throw new Error("Unsafe temporary cleanup path");
  rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
}

await runSmoke().then(() => {
  console.log("Browser smoke passed: existing document workflow, English PDF download from Bangla UI, ordered pages and footers, loading/error recovery, object URL cleanup, responsive layouts, and local-only processing.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
