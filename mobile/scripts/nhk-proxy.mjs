import http from "node:http"
import { fetchNhkArticleHtml, fetchNhkNewsList } from "./nhk-auth.mjs"

const PORT = Number(process.env.NHK_PROXY_PORT || 3847)

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey")
}

const server = http.createServer(async (req, res) => {
  cors(res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain" })
    res.end("Method not allowed")
    return
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`)
  const action = url.searchParams.get("action") ?? "list"

  try {
    if (action === "list") {
      const data = await fetchNhkNewsList()
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(data))
      return
    }

    if (action === "article") {
      const id = url.searchParams.get("id")
      if (!id) {
        res.writeHead(400, { "Content-Type": "text/plain" })
        res.end("Missing id")
        return
      }
      const html = await fetchNhkArticleHtml(id)
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
      return
    }

    res.writeHead(400, { "Content-Type": "text/plain" })
    res.end("Unknown action")
  } catch (err) {
    const message = err instanceof Error ? err.message : "NHK proxy error"
    res.writeHead(502, { "Content-Type": "text/plain" })
    res.end(message)
  }
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`NHK proxy listening on http://0.0.0.0:${PORT}`)
})
