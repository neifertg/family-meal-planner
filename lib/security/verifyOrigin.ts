import type { NextRequest } from 'next/server'

/**
 * Lightweight CSRF defense for cookie-authenticated, state-mutating routes:
 * rejects requests whose Origin (or Referer, as a fallback) doesn't match
 * the host the request was made to.
 */
export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') ?? request.headers.get('referer')

  if (!origin) {
    // Same-origin browser requests always send Origin (or at least Referer)
    // for state-changing fetches; treat a missing header as suspicious.
    return false
  }

  try {
    const originHost = new URL(origin).host
    return originHost === request.nextUrl.host
  } catch {
    return false
  }
}
