/**
 * Shared one-shot call to the game's /api/ai endpoint (Cloudflare Workers AI).
 * Returns a cleaned single-line response, or null on any failure/timeout.
 */
export async function askAI(
  system: string,
  user: string,
  maxTokens = 80,
  timeoutMs = 7000,
): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    clearTimeout(timer)
    const data = await res.json()
    const text = String(data?.result?.response ?? '')
      .replace(/[\n\r"]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length > 2 ? text.slice(0, 120) : null
  } catch {
    return null
  }
}
