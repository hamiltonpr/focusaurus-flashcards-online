import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const USER_AGENT = "Focusaurus/1.0 (language learning app)"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

let cachedCookies: { value: string; expiresAt: number } | null = null
const COOKIE_TTL_MS = 30 * 60 * 1000

function mergeCookieJar(existing: string, setCookies: string[]): string {
  const jar = new Map<string, string>()
  for (const part of existing.split("; ").filter(Boolean)) {
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

function parseSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()
  }
  const raw = headers.get("set-cookie")
  return raw ? [raw] : []
}

async function acquireNhkCookies(): Promise<string> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get("action") ?? "list"

  try {
    const cookie = await acquireNhkCookies()

    if (action === "list") {
      const res = await fetch("https://news.web.nhk/news/easy/news-list.json", {
        headers: { "User-Agent": USER_AGENT, Cookie: cookie },
      })
      if (!res.ok) {
        cachedCookies = null
        return new Response(`NHK news-list returned ${res.status}`, {
          status: 502,
          headers: corsHeaders,
        })
      }
      return new Response(await res.text(), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "article") {
      const id = url.searchParams.get("id")
      if (!id) {
        return new Response("Missing id", { status: 400, headers: corsHeaders })
      }
      const articleUrl = `https://news.web.nhk/news/easy/${id}/${id}.html`
      const res = await fetch(articleUrl, {
        headers: { "User-Agent": USER_AGENT, Cookie: cookie },
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) cachedCookies = null
        return new Response(`NHK article returned ${res.status}`, {
          status: 502,
          headers: corsHeaders,
        })
      }
      return new Response(await res.text(), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      })
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders })
  } catch (err) {
    const message = err instanceof Error ? err.message : "NHK proxy error"
    return new Response(message, { status: 502, headers: corsHeaders })
  }
})
