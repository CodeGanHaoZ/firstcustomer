import { lookup } from "node:dns/promises";
import { request as requestHttp, type IncomingMessage } from "node:http";
import { request as requestHttps } from "node:https";
import { BlockList, isIP } from "node:net";
import { createBrotliDecompress, createUnzip } from "node:zlib";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const USER_AGENT = "FirstCustomerResearch/0.1";
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const MIN_USEFUL_CHARS = 200;

const blockedAddresses = new BlockList();
for (const [base, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 3],
] as const) blockedAddresses.addSubnet(base, prefix, "ipv4");
blockedAddresses.addSubnet("2001::", 32, "ipv6");
blockedAddresses.addSubnet("2002::", 16, "ipv6");

const routableV6 = new BlockList();
routableV6.addSubnet("2000::", 3, "ipv6");
routableV6.addSubnet("::ffff:0:0", 96, "ipv6");

export function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return blockedAddresses.check(address, "ipv4");
  if (family === 6) return !routableV6.check(address, "ipv6") || blockedAddresses.check(address, "ipv6");
  return true;
}

// 网址可能来自网页内容，只允许访问公网，防止读取服务器内部地址。
async function resolvePublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只能读取 http 或 https 网页");
  }
  if (url.username || url.password) throw new Error("网址不能包含登录信息");
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("不允许读取内部网络地址");
  }
  return { url, addresses };
}

export async function assertPublicUrl(raw: string) {
  return (await resolvePublicUrl(raw)).url;
}

export function htmlToText(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  for (const element of document.querySelectorAll("script, style, template")) element.remove();
  const article = new Readability(document).parse();
  const text = article?.textContent ?? document.body?.textContent ?? "";
  return {
    title: article?.title ?? document.title ?? "",
    text: text.replace(/\s+/g, " ").trim(),
  };
}

async function requestPublic(raw: string, accept: string) {
  const { url, addresses } = await resolvePublicUrl(raw);
  const request = url.protocol === "https:" ? requestHttps : requestHttp;
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    request(url, {
      agent: false,
      headers: { "user-agent": USER_AGENT, accept, "accept-encoding": "identity" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Keep the original hostname for TLS. Connect only to addresses checked above.
      lookup: (_hostname, options, callback) => {
        const matches = addresses.filter(({ family }) => !options.family || options.family === family);
        if (options.all) callback(null, matches);
        else if (matches[0]) callback(null, matches[0].address, matches[0].family);
        else callback(new Error("未找到可用的公网地址"), "");
      },
    }, resolve).once("error", reject).end();
  });
  return { response, url };
}

async function responseBody(response: IncomingMessage) {
  const encoding = response.headers["content-encoding"]?.toLowerCase();
  const decoder = encoding === "br" ? createBrotliDecompress()
    : encoding === "gzip" || encoding === "deflate" ? createUnzip() : null;
  const stream = decoder ? response.pipe(decoder) : response;
  if (decoder) response.once("error", (error) => decoder.destroy(error));
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("网页太大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

async function fetchPublic(raw: string, htmlOnly: boolean) {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { response, url } = await requestPublic(current, htmlOnly ? "text/html,text/plain" : "*/*");
    try {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        if (!location) throw new Error("跳转缺少目标地址");
        current = new URL(location, url).toString();
        continue;
      }
      if (status < 200 || status >= 300) throw new Error(`网页返回 HTTP ${status}`);
      const type = response.headers["content-type"] ?? "";
      if (htmlOnly && !/text\/(html|plain)|xhtml/.test(type)) throw new Error(`不支持的内容类型：${type}`);
      const body = await responseBody(response);
      return { body, url: url.toString(), status, type };
    } finally {
      response.destroy();
    }
  }
  throw new Error("跳转次数过多");
}

async function renderWithBrowser(raw: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, offline: true, serviceWorkers: "block" });
    await context.routeWebSocket("**", (socket) => socket.close());
    await context.route("**", async (route) => {
      const request = route.request();
      if (request.method() !== "GET" || ["image", "media", "font"].includes(request.resourceType())) {
        return route.abort();
      }
      try {
        // Fulfill the response rather than letting Chromium follow redirects or resolve DNS itself.
        const { body, status, type } = await fetchPublic(request.url(), false);
        await route.fulfill({ body, status, contentType: type || "application/octet-stream" });
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.goto(raw, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function readPage(raw: string) {
  const { body, url } = await fetchPublic(raw, true);
  const result = htmlToText(body.toString(), url);
  if (result.text.length >= MIN_USEFUL_CHARS) return result;
  if (process.env.READ_PAGE_BROWSER !== "1") return result;
  return htmlToText(await renderWithBrowser(url), url);
}
