export const USER_AGENT = "Focusaurus/1.0 (language learning app)"

let cachedCookies = null
const COOKIE_TTL_MS = 30 * 60 * 1000

export function mergeCookieJar(existing, setCookies) {
  const jar = new Map()
  for (const part of (existing || "").split("; ").filter(Boolean)) {
    const eq = part.indexOf("=")
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1))
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0]?.trim()
    if (!pair) continue
    const eq = pair.indexOf("=")
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
}

function parseSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()
  }
  const raw = headers.get("set-cookie")
  return raw ? [raw] : []
}

export async function acquireNhkCookies() {
  if (cachedCookies && Date.now() < cachedCookies.expiresAt) {
    return cachedCookies.value
  }

  const params = new URLSearchParams({
    idp: "a-alaz",
    profileType: "abroad",
    redirect_uri: "https://news.web.nhk/news/easy/",
    entity: "none",
    area: "130",
    pref: "13",
    jisx0402: "13101",
    postal: "1000001",
  })

  let res = await fetch(`https://news.web.nhk/tix/build_authorize?${params}`, {
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT },
  })
  const buildCookie = mergeCookieJar("", parseSetCookieHeaders(res.headers))

  const loc1 = res.headers.get("location")
  if (!loc1) throw new Error("NHK auth step 1 failed")

  res = await fetch(loc1, {
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT },
  })

  const loc2 = res.headers.get("location")
  if (!loc2) throw new Error("NHK auth step 2 failed")

  res = await fetch(loc2, {
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT, Cookie: buildCookie },
  })

  const cookie = mergeCookieJar(buildCookie, parseSetCookieHeaders(res.headers))
  if (!cookie) throw new Error("NHK auth step 3 failed")

  cachedCookies = { value: cookie, expiresAt: Date.now() + COOKIE_TTL_MS }
  return cookie
}

export async function fetchNhkNewsList() {
  const cookie = await acquireNhkCookies()
  const res = await fetch("https://news.web.nhk/news/easy/news-list.json", {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  })
  if (!res.ok) {
    cachedCookies = null
    throw new Error(`NHK news-list returned ${res.status}`)
  }
  return res.json()
}

export async function fetchNhkArticleHtml(articleId) {
  const cookie = await acquireNhkCookies()
  const url = `https://news.web.nhk/news/easy/${articleId}/${articleId}.html`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) cachedCookies = null
    throw new Error(`NHK article returned ${res.status}`)
  }
  return res.text()
}
