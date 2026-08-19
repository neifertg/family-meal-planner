import { promises as dns } from 'dns'
import net from 'net'

/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 * Rejects non-http(s) schemes, embedded credentials, and hostnames that
 * resolve to private/loopback/link-local/reserved IP ranges.
 * Throws on any rejection; callers should catch and return a 4xx.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }

  const hostname = parsed.hostname
  const addresses: string[] = []

  if (net.isIP(hostname)) {
    addresses.push(hostname)
  } else {
    const results = await dns.lookup(hostname, { all: true })
    addresses.push(...results.map((r) => r.address))
  }

  if (addresses.length === 0) {
    throw new Error('Could not resolve hostname')
  }

  for (const address of addresses) {
    if (isDisallowedAddress(address)) {
      throw new Error('URL resolves to a disallowed private or reserved address')
    }
  }
}

function isDisallowedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number)
    const [a, b] = octets

    if (a === 127) return true // loopback
    if (a === 10) return true // private
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 169 && b === 254) return true // link-local (incl. cloud metadata)
    if (a === 0) return true // "this" network
    if (a >= 224) return true // multicast/reserved

    return false
  }

  if (net.isIPv6(address)) {
    const lower = address.toLowerCase()

    if (lower === '::1') return true // loopback
    if (lower === '::') return true // unspecified
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local (fc00::/7)
    if (lower.startsWith('fe80')) return true // link-local

    // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) — check the embedded IPv4
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isDisallowedAddress(mapped[1])

    return false
  }

  return true // unrecognized address format — fail closed
}
