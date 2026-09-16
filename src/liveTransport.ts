/**
 * Live-data transport policy.
 *
 * GitHub Pages / grokbottech.com has no local agent server. Never open
 * ws://localhost:3334 or poll http://localhost:3334/roster there — status.json
 * polling is the sole live path. Local WS is loopback-only.
 */

export const LOCAL_WS_URL = 'ws://localhost:3334/ws'
export const LOCAL_ROSTER_URL = 'http://localhost:3334/roster'
export const LOCAL_CHAT_URL = 'http://127.0.0.1:3334/chat'

export function currentHostname(): string {
  try {
    const loc = (globalThis as { location?: { hostname?: string } }).location
    return loc?.hostname ?? ''
  } catch {
    return ''
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host === '0:0:0:0:0:0:0:1'
}

/** Apex Pages domain, its subdomains, and GitHub Pages project hosts. */
export function isPagesHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!host) return false
  if (host === 'grokbottech.com' || host.endsWith('.grokbottech.com')) return true
  if (host.endsWith('.github.io')) return true
  return false
}

export function shouldUseLocalAgentSocket(hostname = currentHostname()): boolean {
  if (!hostname) return false
  if (isPagesHost(hostname)) return false
  return isLoopbackHost(hostname)
}

export function isLoopbackWsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return false
    return isLoopbackHost(parsed.hostname)
  } catch {
    return false
  }
}

export function resolveLocalWsUrl(hostname = currentHostname()): string | null {
  return shouldUseLocalAgentSocket(hostname) ? LOCAL_WS_URL : null
}

export function resolveLocalRosterUrl(hostname = currentHostname()): string | null {
  return shouldUseLocalAgentSocket(hostname) ? LOCAL_ROSTER_URL : null
}

export function resolveLocalChatUrl(hostname = currentHostname()): string | null {
  return shouldUseLocalAgentSocket(hostname) ? LOCAL_CHAT_URL : null
}

/** Whether the agent WebSocket should be constructed at all. */
export function shouldOpenAgentSocket(opts: {
  disabled?: boolean
  url?: string | null
  hostname?: string
} = {}): boolean {
  if (opts.disabled) return false
  const hostname = opts.hostname ?? currentHostname()
  if (!shouldUseLocalAgentSocket(hostname)) return false
  const url = opts.url === undefined ? resolveLocalWsUrl(hostname) : opts.url
  if (!url) return false
  return isLoopbackWsUrl(url)
}
