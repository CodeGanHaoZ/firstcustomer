import type { ModelClient } from "@/ai/types";
import { readPage } from "./fetch-page";

export type SourceResult = {
  url: string;
  title: string;
  text: string;
  publishedAt?: string;
};

export type SearchOutcome = { results: SourceResult[]; searchCalls: number };

export type SourceClient = {
  names: string[];
  help?: string;
  search: (source: string, query: string) => Promise<SearchOutcome>;
  readPage: (url: string) => Promise<{ title: string; text: string }>;
};

const USER_AGENT = "FirstCustomerResearch/0.1";
const MAX_DOC_CHARS = 6000;

async function getJson<T>(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json", ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`来源返回 HTTP ${response.status}`);
  return (await response.json()) as T;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchHn(query: string): Promise<SourceResult[]> {
  const params = new URLSearchParams({ query, tags: "(story,comment)", hitsPerPage: "8" });
  const data = await getJson<{
    hits: {
      objectID: string;
      title?: string;
      story_title?: string;
      story_text?: string;
      comment_text?: string;
      created_at: string;
    }[];
  }>(`https://hn.algolia.com/api/v1/search?${params}`);
  return data.hits.map((hit) => ({
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title ?? hit.story_title ?? "Hacker News",
    text: stripHtml(hit.comment_text ?? hit.story_text ?? hit.title ?? ""),
    publishedAt: hit.created_at,
  }));
}

async function searchGithubIssues(query: string): Promise<SourceResult[]> {
  const params = new URLSearchParams({ q: `${query} is:issue`, per_page: "8" });
  const token = process.env.GITHUB_TOKEN;
  const data = await getJson<{
    items: { html_url: string; title: string; body: string | null; created_at: string }[];
  }>(
    `https://api.github.com/search/issues?${params}`,
    token ? { authorization: `Bearer ${token}` } : {},
  );
  return data.items.map((item) => ({
    url: item.html_url,
    title: item.title,
    text: `${item.title}\n${item.body ?? ""}`.slice(0, MAX_DOC_CHARS),
    publishedAt: item.created_at,
  }));
}

async function searchStackExchange(query: string): Promise<SourceResult[]> {
  const params = new URLSearchParams({
    order: "desc",
    sort: "relevance",
    q: query,
    site: "stackoverflow",
    filter: "withbody",
    pagesize: "8",
  });
  const data = await getJson<{
    items: { link: string; title: string; body?: string; creation_date: number }[];
  }>(`https://api.stackexchange.com/2.3/search/advanced?${params}`);
  return data.items.map((item) => ({
    url: item.link,
    title: stripHtml(item.title),
    text: stripHtml(`${item.title} ${item.body ?? ""}`).slice(0, MAX_DOC_CHARS),
    publishedAt: new Date(item.creation_date * 1000).toISOString(),
  }));
}

async function searchItunes(query: string): Promise<SourceResult[]> {
  const params = new URLSearchParams({ term: query, entity: "software", limit: "5" });
  const data = await getJson<{
    results: {
      trackName: string;
      trackViewUrl: string;
      userRatingCount?: number;
      formattedPrice?: string;
      description?: string;
    }[];
  }>(`https://itunes.apple.com/search?${params}`);
  return data.results.map((app) => ({
    url: app.trackViewUrl,
    title: app.trackName,
    text: `${app.trackName}. App Store user rating count: ${app.userRatingCount ?? 0}. Price: ${app.formattedPrice ?? "unknown"}. ${app.description ?? ""}`.slice(0, MAX_DOC_CHARS),
  }));
}

async function npmDownloads(packageName: string): Promise<SourceResult[]> {
  const name = encodeURIComponent(packageName.trim()).replace("%40", "@").replace("%2F", "/");
  const data = await getJson<{ downloads: number; package: string }>(
    `https://api.npmjs.org/downloads/point/last-month/${name}`,
  );
  return [
    {
      url: `https://www.npmjs.com/package/${data.package}`,
      title: data.package,
      text: `${data.package} npm downloads in the last month: ${data.downloads}`,
    },
  ];
}

const snapshotDate = (timestamp: string) =>
  `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;

// 只说明页面从什么时候起一直有快照。要证明当时在收费，还得用 read_page 读快照内容。
export async function searchWayback(pageUrl: string): Promise<SourceResult[]> {
  const fetchRow = async (limit: string) => {
    const params = new URLSearchParams({
      url: pageUrl,
      output: "json",
      fl: "timestamp,original",
      filter: "statuscode:200",
      limit,
    });
    const rows = await getJson<string[][]>(`https://web.archive.org/cdx/search/cdx?${params}`);
    return rows[1];
  };
  const first = await fetchRow("1");
  if (!first) return [];
  const last = await fetchRow("-1");
  const summary = `Wayback Machine has successful captures of ${first[1]} from ${snapshotDate(first[0])} to ${snapshotDate(last[0])}.`;
  return [first, last].map(([timestamp, original]) => ({
    url: `https://web.archive.org/web/${timestamp}/${original}`,
    title: `Wayback ${snapshotDate(timestamp)}`,
    text: summary,
    publishedAt: snapshotDate(timestamp),
  }));
}

export async function searchDevto(tag: string): Promise<SourceResult[]> {
  const cleaned = tag.toLowerCase().replace(/[^a-z0-9]/g, "");
  const params = new URLSearchParams({ tag: cleaned, per_page: "8" });
  const articles = await getJson<
    { url: string; title: string; description: string; published_at: string }[]
  >(`https://dev.to/api/articles?${params}`);
  return articles.map((article) => ({
    url: article.url,
    title: article.title,
    text: `${article.title}. ${article.description}`,
    publishedAt: article.published_at,
  }));
}

const SOURCE_HELP: Record<string, string> = {
  hn: "hn（Hacker News 帖子和评论，query 用关键词）",
  github_issues: "github_issues（GitHub Issues，query 用关键词）",
  stackexchange: "stackexchange（Stack Overflow，query 用关键词）",
  devto: "devto（dev.to 文章，query 只能是一个标签，如 saas）",
  itunes: "itunes（App Store 应用和评分数，query 用应用名）",
  npm: "npm（上个月下载量，query 是包名）",
  wayback: "wayback（历史快照时间范围，query 是页面网址，如 otter.ai/pricing）",
  web: "web（MiMo 联网搜索，query 用关键词）",
};

export function createLiveSources(model: ModelClient): SourceClient {
  const direct: Record<string, (query: string) => Promise<SourceResult[]>> = {
    hn: searchHn,
    github_issues: searchGithubIssues,
    stackexchange: searchStackExchange,
    devto: searchDevto,
    itunes: searchItunes,
    npm: npmDownloads,
    wayback: searchWayback,
  };
  // 联网搜索是 MiMo 的插件，换成其他服务商时不提供。
  const webEnabled =
    process.env.MIMO_WEB_SEARCH === "1" && (process.env.LLM_PROVIDER ?? "mimo") === "mimo";
  const names = [...Object.keys(direct), ...(webEnabled ? ["web"] : [])];
  return {
    names,
    help: names.map((name) => SOURCE_HELP[name]).join("；"),
    readPage,
    async search(source, query) {
      if (source === "web" && webEnabled) {
        const response = await model({
          agent: "research:web_search",
          tier: "flash",
          webSearch: true,
          messages: [{ role: "user", content: query }],
        });
        return {
          searchCalls: response.usage.searchCalls,
          results: response.citations.map((c) => ({
            url: c.url,
            title: c.title,
            text: c.summary,
            publishedAt: c.publishTime,
          })),
        };
      }
      const search = direct[source];
      if (!search) throw new Error(`没有这个来源：${source}`);
      return { results: await search(query), searchCalls: 0 };
    },
  };
}
