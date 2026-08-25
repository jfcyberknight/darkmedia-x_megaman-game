/**
 * Pages advanced-mode worker — routes /api/ai to Workers AI (env.AI binding),
 * everything else is served from the static assets.
 */

const MODEL = '@cf/meta/llama-3.2-1b-instruct'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/ai') {
      if (request.method === 'GET') {
        return Response.json({ ok: true, endpoint: '/api/ai', method: 'POST', model: MODEL })
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'method not allowed' }, { status: 405 })
      }
      if (!env.AI) {
        return Response.json({ error: 'AI binding not configured on this project' }, { status: 500 })
      }
      try {
        const body = await request.json()
        const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : null
        if (!messages || messages.length === 0) {
          return Response.json({ error: 'messages[] required' }, { status: 400 })
        }
        const result = await env.AI.run(MODEL, {
          messages,
          max_tokens: Math.min(body.maxTokens ?? 256, 512),
        })
        return Response.json({ success: true, result })
      } catch (err) {
        return Response.json({ success: false, error: String(err) }, { status: 502 })
      }
    }

    return env.ASSETS.fetch(request)
  },
}
