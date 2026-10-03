#!/usr/bin/env node
/**
 * Header-gated HLS proxy — the M0 spike B fixture.
 *
 * The claim to prove: react-native-video (ExoPlayer) attaches the extension's
 * `headers` to the playlist request *and* to every segment request, so a
 * protected HLS stream plays straight from the origin with no rewriting step.
 * A public stream cannot prove that — it plays with or without headers.
 *
 * So this proxy refuses every request that does not carry `X-Pixi: spike` and
 * rewrites the upstream playlist so that all playlist and segment URIs point
 * back through it. Playback therefore succeeds only if the player really did
 * send the header on all of them; any gap shows up as a 403 stall.
 *
 * `/stats` reports how many requests were served vs refused, which the spike
 * screen shows as evidence.
 *
 * Usage:  node scripts/hls-proxy-server.mjs [port]
 * From the emulator the app reaches this host at http://10.0.2.2:<port>
 */
import { createServer } from 'node:http'

const PORT = Number(process.argv[2] ?? 8766)
const UPSTREAM = process.env.UPSTREAM ?? 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
const HEADER = 'x-pixi'
const HEADER_VALUE = 'spike'

let served = 0
let refused = 0
let bytes = 0

const isPlaylist = (text) => text.trimStart().startsWith('#EXTM3U')

/** Point every URI in a playlist back through `/proxy`, resolved absolutely. */
function rewritePlaylist(text, baseUrl) {
  const via = (uri) => `/proxy?u=${encodeURIComponent(new URL(uri, baseUrl).toString())}`
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.length === 0) return line
      if (trimmed.startsWith('#')) {
        return line.includes('URI="')
          ? line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${via(uri)}"`)
          : line
      }
      return via(trimmed)
    })
    .join('\n')
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

async function forward(req, res, target) {
  const upstreamHeaders = {}
  for (const name of ['range', 'accept-encoding', 'user-agent']) {
    if (req.headers[name]) upstreamHeaders[name] = req.headers[name]
  }
  let upstream
  try {
    upstream = await fetch(target, { headers: upstreamHeaders, redirect: 'follow' })
  } catch (error) {
    return send(res, 502, `upstream error: ${error.message}\n`, { 'content-type': 'text/plain' })
  }

  const declared = upstream.headers.get('content-type') ?? ''
  const looksLikePlaylist = /mpegurl|#EXTM3U/i.test(declared) || target.includes('.m3u8')

  if (looksLikePlaylist) {
    const body = rewritePlaylist(await upstream.text(), target)
    served += 1
    bytes += Buffer.byteLength(body)
    return send(res, upstream.status, body, {
      'content-type': 'application/vnd.apple.mpegurl',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    })
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  served += 1
  bytes += buffer.length
  const passthrough = {}
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(name)
    if (value) passthrough[name] = value
  }
  passthrough['access-control-allow-origin'] = '*'
  res.writeHead(upstream.status, passthrough)
  res.end(buffer)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://10.0.2.2:${PORT}`)

  if (url.pathname === '/stats') {
    return send(res, 200, JSON.stringify({ served, refused, bytes, upstream: UPSTREAM }), {
      'content-type': 'application/json',
    })
  }

  if ((req.headers[HEADER] ?? '').toLowerCase() !== HEADER_VALUE) {
    refused += 1
    console.log(`403 ${url.pathname} — missing "${HEADER}" header`)
    return send(res, 403, 'forbidden: required header absent\n', { 'content-type': 'text/plain' })
  }

  if (url.pathname === '/stream.m3u8') {
    return forward(req, res, UPSTREAM)
  }
  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('u')
    if (!target || !/^https?:\/\//.test(target)) {
      return send(res, 400, 'bad target\n', { 'content-type': 'text/plain' })
    }
    return forward(req, res, target)
  }
  return send(res, 404, 'not found\n', { 'content-type': 'text/plain' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HLS proxy listening on :${PORT} — upstream ${UPSTREAM}`)
  console.log(`every request must carry "${HEADER}: ${HEADER_VALUE}" or it is refused`)
})
