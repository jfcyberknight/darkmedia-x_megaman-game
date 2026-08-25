/**
 * Pages Function — POST /api/ai
 * Calls Cloudflare Workers AI through the project's AI binding (env.AI).
 * Body: { messages: [{role, content}], maxTokens?: number }
 */

const MODEL = '@cf/meta/llama-3.2-1b-instruct'

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.AI) {
    return Response.json(
      { error: 'AI binding not configured on this Pages project' },
      { status: 500 },
    )
  }
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : null
  if (!messages || messages.length === 0) {
    return Response.json({ error: 'messages[] required' }, { status: 400 })
  }
  try {
    const result = await env.AI.run(MODEL, {
      messages,
      max_tokens: Math.min(body.maxTokens ?? 256, 512),
    })
    return Response.json({ success: true, result })
  } catch (err) {
    return Response.json({ success: false, error: String(err) }, { status: 502 })
  }
}

export async function onRequestGet() {
  return Response.json({
    ok: true,
    endpoint: '/api/ai',
    method: 'POST',
    model: MODEL,
    aiBinding: 'see project settings',
  })
}
