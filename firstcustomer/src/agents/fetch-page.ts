import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const USER_AGENT = "FirstCustomerResearch/0.1";
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const MIN_USEFUL_CHARS = 200;

export function isPrivateAddress(address: string) {
  const ip = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return (
    ip === "::" ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    /^fe[89ab]/.test(ip)
  );
}

// 网址可能来自网页内容，只允许访问公网，防止读取服务器内部地址。
export async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只能读取 http 或 https 网页");
  }
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("不允许读取内部网络地址");
  }
  return url;
}

export function htmlToText(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  const text = article?.textContent ?? dom.window.document.body?.textContent ?? "";
  return {
    title: article?.title ?? dom.window.document.title ?? "",
    text: text.replace(/\s+/g, " ").trim(),
  };
}

async function fetchHtml(raw: string) {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("跳转缺少目标地址");
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`网页返回 HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)|xhtml/.test(type)) {
      throw new Error(`不支持的内容类型：${type}`);
    }
    const body = await response.text();
    if (body.length > MAX_BYTES) throw new Error("网页太大");
    return { html: body, url: current };
  }
  throw new Error("跳转次数过多");
}

async function renderWithBrowser(raw: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.route("**", async (route) => {
      try {
        await assertPublicUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    await page.goto(raw, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function readPage(raw: string) {
  const { html, url } = await fetchHtml(raw);
  const result = htmlToText(html, url);
  if (result.text.length >= MIN_USEFUL_CHARS) return result;
  if (process.env.READ_PAGE_BROWSER !== "1") return result;
  return htmlToText(await renderWithBrowser(url), url);
}
