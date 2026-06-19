import { mergeOkuriganaSegments } from "./reading-utils"
import { tokenizeFromRubySegments } from "./tokenize"
import type { NhkEasyArticle, TokenizedStory } from "./types"
import type { Card } from "../../types"

const NHK_EASY_BASE = "https://news.web.nhk/news/easy/"
const NHK_ATTRIBUTION = "Content from NHK NEWS WEB EASY (https://news.web.nhk/news/easy/)"

interface NhkListArticle {
  news_id: string
  title: string
  title_with_ruby?: string
  news_prearranged_time?: string
}

interface RubySegment {
  text: string
  reading?: string
  kanjiText?: string
  kanjiReading?: string
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ""))
}

function getNhkProxyBase(): string | null {
  const localProxy = process.env.EXPO_PUBLIC_NHK_PROXY_URL?.replace(/\/$/, "")
  if (localProxy) return localProxy

  if (process.env.EXPO_PUBLIC_NHK_USE_SUPABASE === "1") {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
    if (supabaseUrl) return `${supabaseUrl}/functions/v1/nhk-easy`
  }

  return null
}

async function fetchViaNhkProxy(path: string): Promise<Response> {
  const base = getNhkProxyBase()
  if (!base) {
    throw new Error(
      "NHK news unavailable — run `npm start` from the mobile folder (starts a local proxy), or deploy the nhk-easy Supabase function",
    )
  }

  const headers: Record<string, string> = {}
  if (base.includes("supabase.co")) {
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    if (!key) throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY")
    headers.Authorization = `Bearer ${key}`
    headers.apikey = key
  }

  const res = await fetch(`${base}${path}`, { headers })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(
      detail.trim() || `NHK proxy error (${res.status})`,
    )
  }
  return res
}

function formatNhkDate(iso?: string): string {
  if (!iso) return ""
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return iso
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`
}

function flattenNewsList(data: unknown): NhkListArticle[] {
  if (!Array.isArray(data)) return []
  const articles: NhkListArticle[] = []
  for (const dayBlock of data) {
    if (!dayBlock || typeof dayBlock !== "object") continue
    for (const dayArticles of Object.values(dayBlock as Record<string, unknown>)) {
      if (!Array.isArray(dayArticles)) continue
      for (const article of dayArticles) {
        if (article && typeof article === "object" && "news_id" in article) {
          articles.push(article as NhkListArticle)
        }
      }
    }
  }
  return articles
}

export async function fetchNhkEasyArticles(): Promise<NhkEasyArticle[]> {
  const res = await fetchViaNhkProxy("?action=list")
  const data = await res.json()
  const listed = flattenNewsList(data)
  const seen = new Set<string>()
  const articles: NhkEasyArticle[] = []

  for (const article of listed) {
    if (!article.news_id || seen.has(article.news_id)) continue
    seen.add(article.news_id)
    articles.push({
      id: article.news_id,
      title: article.title,
      date: formatNhkDate(article.news_prearranged_time),
      url: `${NHK_EASY_BASE}${article.news_id}/${article.news_id}.html`,
    })
  }

  if (articles.length === 0) {
    throw new Error("No NHK Easy articles found")
  }

  return articles.slice(0, 8)
}

function parseRubyHtml(html: string): RubySegment[] {
  const segments: RubySegment[] = []
  let i = 0

  while (i < html.length) {
    const rubyStart = html.indexOf("<ruby>", i)
    if (rubyStart === -1) {
      const rest = stripTags(html.slice(i))
      if (rest) segments.push({ text: rest })
      break
    }

    const plain = stripTags(html.slice(i, rubyStart))
    if (plain) segments.push({ text: plain })

    const rubyEnd = html.indexOf("</ruby>", rubyStart)
    if (rubyEnd === -1) break

    const rubyBlock = html.slice(rubyStart, rubyEnd + 7)
    const rtMatch = rubyBlock.match(/<rt[^>]*>([\s\S]*?)<\/rt>/i)
    const base = stripTags(rubyBlock.replace(/<rt[\s\S]*?<\/rt>/gi, ""))
    if (base) {
      segments.push({ text: base, reading: rtMatch ? stripTags(rtMatch[1]) : undefined })
    }

    i = rubyEnd + 7
  }

  return segments
}

function splitIntoTokens(segments: RubySegment[]): RubySegment[] {
  const expanded: RubySegment[] = []
  const punctPattern = /([。、！？…「」『』（）()・\s]+)/

  for (const segment of segments) {
    const parts = segment.text.split(punctPattern).filter(Boolean)
    for (const part of parts) {
      if (/^[。、！？…「」『』（）()・\s]+$/.test(part)) {
        expanded.push({ text: part })
      } else {
        expanded.push({
          text: part,
          reading: part === segment.text ? segment.reading : undefined,
          kanjiText: part === segment.text ? segment.kanjiText : undefined,
          kanjiReading: part === segment.text ? segment.kanjiReading : undefined,
        })
      }
    }
  }

  return expanded
}

function extractArticleParagraphs(html: string): string[] {
  const bodyStart = html.search(/id="js-article-body"/i)
  if (bodyStart === -1) return []

  const openTagEnd = html.indexOf(">", bodyStart)
  if (openTagEnd === -1) return []

  const bodyHtml = html.slice(openTagEnd + 1)
  const paragraphs: string[] = []
  const pattern = /<p[^>]*>[\s\S]*?<\/p>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(bodyHtml)) !== null) {
    if (match.index > 100_000) break
    paragraphs.push(match[0])
  }
  return paragraphs
}

export async function fetchNhkEasyArticle(
  articleId: string,
  stackCards: Card[] = [],
): Promise<TokenizedStory> {
  const res = await fetchViaNhkProxy(`?action=article&id=${encodeURIComponent(articleId)}`)
  const html = await res.text()

  const titleMatch =
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ??
    html.match(/<title>([\s\S]*?)<\/title>/i)
  const title = stripTags(titleMatch?.[1] ?? "NHK Easy News")
    .replace(/\s*\|\s*NHK.*$/i, "")
    .trim()

  const paragraphs = extractArticleParagraphs(html)
  if (paragraphs.length === 0) {
    throw new Error("Could not parse article body")
  }

  const allSegments: RubySegment[] = []
  for (let p = 0; p < paragraphs.length; p += 1) {
    const parsed = parseRubyHtml(paragraphs[p])
    allSegments.push(...splitIntoTokens(mergeOkuriganaSegments(parsed)))
    if (p < paragraphs.length - 1) {
      allSegments.push({ text: "\n\n" })
    }
  }

  return {
    title,
    tokens: tokenizeFromRubySegments(allSegments, stackCards),
    source: "nhk-easy",
    sourceId: articleId,
    attribution: NHK_ATTRIBUTION,
  }
}

export function rankNhkArticles(
  articles: NhkEasyArticle[],
  recentWords: string[],
  knownWords: string[],
): NhkEasyArticle[] {
  const targets = [...recentWords, ...knownWords].map((w) => w.split("\n")[0]?.trim()).filter(Boolean)
  if (targets.length === 0) return articles

  return articles
    .slice()
    .sort((a, b) => {
      const score = (article: NhkEasyArticle) => {
        const hay = `${article.title}`
        return targets.reduce((sum, word) => (hay.includes(word) ? sum + 1 : sum), 0)
      }
      return score(b) - score(a)
    })
}
