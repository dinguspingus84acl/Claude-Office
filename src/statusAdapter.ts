/**
 * status.json adapter — poll GrokBotTech office status and emit donor lifecycle events.
 *
 * Identical fingerprints MUST NOT trigger movement, sounds, bubbles, or animation restarts.
 */

import { useEffect, useRef } from 'react'
import type { Agent, AgentState, OfficeEvent } from './types'
import type { DutyStatus } from './types'
import { OPERATORS, resolveOperator, DEFAULT_STATUS_URLS } from './operators'

export interface NormalizedRecord {
  id: string
  name: string
  role: string
  status: DutyStatus
  task: string
  progress: number
  lastAction: string
  updatedAt: string
  companion: string
  companionId: string
  color: string
  present: boolean
}

export function fingerprint(record: NormalizedRecord): string {
  return [
    record.id,
    record.status,
    record.task,
    String(record.progress),
    record.lastAction,
    record.present ? '1' : '0',
  ].join('|')
}

const DUTY_STATUSES: DutyStatus[] = [
  'offline', 'idle', 'reading', 'thinking', 'working', 'running_tool',
  'waiting', 'needs_approval', 'blocked', 'done', 'failed',
]

function asDuty(raw: unknown): DutyStatus {
  const s = String(raw ?? 'idle').toLowerCase().replace(/[-\s]/g, '_')
  if (s === 'offline' || s === 'absent' || s === 'inactive') return 'offline'
  if (s === 'run_tool' || s === 'tool' || s === 'running') return 'running_tool'
  if (s === 'needsapproval' || s === 'approval' || s === 'needs_you') return 'needs_approval'
  if ((DUTY_STATUSES as string[]).includes(s)) return s as DutyStatus
  return 'idle'
}

function clampProgress(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return 0
  if (n <= 1 && n >= 0) return Math.round(n * 100)
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function resolveStatusUrl(): string {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('status')
  if (fromQuery) return fromQuery
  const env = (import.meta as { env?: Record<string, string> }).env
  if (env?.VITE_STATUS_URL) return env.VITE_STATUS_URL
  return DEFAULT_STATUS_URLS[0]
}

export function normalizeStatusPayload(raw: unknown): NormalizedRecord[] {
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  const stations = Array.isArray(data.stations)
    ? data.stations
    : Array.isArray(data.operators)
      ? data.operators
      : Array.isArray(data.agents)
        ? data.agents
        : []

  const updatedAt = typeof data.updated_at_utc === 'string'
    ? data.updated_at_utc
    : typeof data.updatedAt === 'string'
      ? data.updatedAt
      : new Date().toISOString()

  const seen = new Set<string>()
  const records: NormalizedRecord[] = []

  for (const item of stations) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const op = resolveOperator(String(row.id ?? ''))
      ?? resolveOperator(String(row.character ?? row.name ?? ''))
    if (!op || seen.has(op.id)) continue
    seen.add(op.id)

    const status = asDuty(row.state ?? row.status)
    records.push({
      id: op.id,
      name: typeof row.character === 'string' ? row.character : op.name,
      role: typeof row.role === 'string' ? row.role : op.role,
      status,
      task: String(row.task ?? ''),
      progress: clampProgress(row.progress),
      lastAction: String(row.stage ?? row.lastAction ?? row.statusText ?? ''),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : updatedAt,
      companion: typeof row.creature === 'string' ? row.creature : op.companion,
      companionId: typeof row.creature_id === 'string' ? row.creature_id : op.companionId,
      color: typeof row.color === 'string' ? row.color : op.color,
      present: status !== 'offline',
    })
  }

  // Permanent roster: fill any missing operators as idle/offline so slots stay mapped
  for (const op of OPERATORS) {
    if (seen.has(op.id)) continue
    records.push({
      id: op.id,
      name: op.name,
      role: op.role,
      status: 'idle',
      task: '',
      progress: 0,
      lastAction: '',
      updatedAt,
      companion: op.companion,
      companionId: op.companionId,
      color: op.color,
      present: true,
    })
  }

  return records
}

export function dutyToAgentState(status: DutyStatus): AgentState {
  switch (status) {
    case 'offline':
      return 'completed'
    case 'idle':
    case 'waiting':
    case 'needs_approval':
    case 'blocked':
    case 'failed':
    case 'done':
      return 'idle'
    case 'reading':
    case 'thinking':
    case 'working':
    case 'running_tool':
      return 'working'
    default:
      return 'idle'
  }
}

export function dutyEffect(
  status: DutyStatus,
  cueOnce: boolean,
): string | null {
  switch (status) {
    case 'reading':
      return '/sprites/effects/post-it.png'
    case 'thinking':
      return '/sprites/effects/star.png'
    case 'working':
      return null
    case 'running_tool':
      return '/sprites/effects/rocket.png'
    case 'waiting':
      return '/sprites/effects/sleeping.png'
    case 'needs_approval':
      return '/sprites/effects/post-it.png'
    case 'blocked':
    case 'failed':
      return '/sprites/effects/build-failed.png'
    case 'done':
      return cueOnce ? '/sprites/effects/thumb-up.png' : null
    default:
      return null
  }
}

export interface DutyApplyResult {
  agent: Agent
  events: OfficeEvent[]
  sfx: 'celebration' | 'error' | 'notification' | 'doorOpen' | null
  chat?: string
  restartAnim: boolean
}

export function applyRecordToAgent(
  agent: Agent,
  record: NormalizedRecord,
  prevPrint: string | undefined,
): DutyApplyResult {
  const nextPrint = fingerprint(record)
  if (prevPrint === nextPrint) {
    return { agent, events: [], sfx: null, restartAnim: false }
  }

  const wasOffline = agent.dutyStatus === 'offline' || agent.present === false
  const goingOffline = record.status === 'offline'
  const comingOnline = wasOffline && record.present
  const events: OfficeEvent[] = []
  let sfx: DutyApplyResult['sfx'] = null
  let chat: string | undefined
  let next: Agent = {
    ...agent,
    name: record.name,
    role: record.role,
    task: record.task,
    statusText: record.lastAction || record.task,
    dutyStatus: record.status,
    progress: record.progress,
    companion: record.companion,
    companionId: record.companionId,
    color: record.color,
    lastAction: record.lastAction,
    updatedAt: record.updatedAt,
    present: record.present,
  }

  if (goingOffline && agent.present !== false) {
    events.push({ type: 'agent_completed', agentId: agent.id, result: 'session ended' })
    next = {
      ...next,
      state: 'completed',
      present: true,
    }
    chat = 'signing off'
    sfx = 'doorOpen'
    return { agent: next, events, sfx, chat, restartAnim: true }
  }

  if (comingOnline) {
    events.push({
      type: 'agent_spawned',
      agent: { id: agent.id, name: record.name, role: record.role, task: record.task },
    })
    next = {
      ...next,
      state: 'new-hire',
      present: true,
    }
    chat = record.task ? record.task : 'clocked in'
    sfx = 'doorOpen'
    return { agent: next, events, sfx, chat, restartAnim: true }
  }

  const mapped = dutyToAgentState(record.status)
  const atDesk = Math.abs(agent.position.x - agent.deskPosition.x) < 1
    && Math.abs(agent.position.y - agent.deskPosition.y) < 1
  const inbound = agent.state === 'new-hire' || agent.state === 'walking-to-desk'

  if (inbound) {
    next = { ...next, state: agent.state }
  } else if (!atDesk && record.present) {
    next = { ...next, state: 'walking-to-desk' }
  } else if (record.present) {
    next = { ...next, state: mapped }
  }

  if (record.status === 'working' || record.status === 'running_tool' || record.status === 'reading' || record.status === 'thinking') {
    events.push({ type: 'agent_working', agentId: agent.id, status: record.lastAction || record.task })
    chat = record.lastAction || record.task
  } else if (record.status === 'done') {
    events.push({ type: 'agent_completed', agentId: agent.id, result: record.lastAction || 'done' })
    chat = record.lastAction || 'done'
    sfx = 'celebration'
  } else if (record.status === 'failed' || record.status === 'blocked') {
    events.push({ type: 'agent_working', agentId: agent.id, status: record.lastAction || record.status })
    chat = record.lastAction || record.status
    sfx = 'error'
  } else if (record.status === 'needs_approval') {
    events.push({ type: 'agent_working', agentId: agent.id, status: record.lastAction || 'needs review' })
    chat = record.lastAction || 'needs review'
    sfx = 'notification'
  } else if (record.lastAction) {
    chat = record.lastAction
  }

  return { agent: next, events, sfx, chat, restartAnim: true }
}

export interface StatusTick {
  records: NormalizedRecord[]
  changed: NormalizedRecord[]
  prints: Map<string, string>
}

export function diffRecords(
  records: NormalizedRecord[],
  prev: Map<string, string>,
): StatusTick {
  const changed: NormalizedRecord[] = []
  const prints = new Map(prev)
  for (const rec of records) {
    const fp = fingerprint(rec)
    if (prev.get(rec.id) !== fp) {
      changed.push(rec)
      prints.set(rec.id, fp)
    }
  }
  return { records, changed, prints }
}

export async function fetchStatusJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`status ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function fetchStatusWithFallback(urls: string[]): Promise<{ url: string; data: unknown }> {
  let lastErr: unknown
  for (const url of urls) {
    try {
      const data = await fetchStatusJson(url)
      return { url, data }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('status unavailable')
}

export function useStatusFeed(options: {
  enabled: boolean
  urls: string[]
  intervalMs?: number
  onTick: (tick: StatusTick, raw: unknown) => void
  onError?: (err: Error) => void
}): { live: boolean; source: string | null } {
  const printsRef = useRef<Map<string, string>>(new Map())
  const onTickRef = useRef(options.onTick)
  const onErrorRef = useRef(options.onError)
  const liveRef = useRef(false)
  const sourceRef = useRef<string | null>(null)

  useEffect(() => { onTickRef.current = options.onTick }, [options.onTick])
  useEffect(() => { onErrorRef.current = options.onError }, [options.onError])

  useEffect(() => {
    if (!options.enabled) return
    let cancelled = false

    const poll = async () => {
      try {
        const { url, data } = await fetchStatusWithFallback(options.urls)
        if (cancelled) return
        const records = normalizeStatusPayload(data)
        const tick = diffRecords(records, printsRef.current)
        printsRef.current = tick.prints
        sourceRef.current = url
        liveRef.current = true
        onTickRef.current(tick, data)
      } catch (err) {
        liveRef.current = false
        onErrorRef.current?.(err instanceof Error ? err : new Error('status poll failed'))
      }
    }

    void poll()
    const id = setInterval(() => { void poll() }, options.intervalMs ?? 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [options.enabled, options.intervalMs, options.urls.join('|')])

  return { live: liveRef.current, source: sourceRef.current }
}

export function seedPrints(records: NormalizedRecord[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const rec of records) map.set(rec.id, fingerprint(rec))
  return map
}
