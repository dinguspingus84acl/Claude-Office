/**
 * useAgentSocket — optional local-dev WebSocket for the Agent Office.
 *
 * On grokbottech.com / *.github.io this hook never opens a socket and never
 * polls localhost roster. Production live data is status.json polling only.
 *
 * On loopback hosts it may connect to ws://localhost:3334/ws. Failures soft-stop
 * after a few retries so a missing local server does not spam reconnects.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { OfficeEvent } from '../types'
import {
  currentHostname,
  resolveLocalRosterUrl,
  resolveLocalWsUrl,
  shouldOpenAgentSocket,
} from '../liveTransport'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentSocketOptions {
  /** Called for every incoming event. Stable reference recommended (useCallback). */
  onEvent?: (event: OfficeEvent) => void
  /** WebSocket URL. Ignored unless the page is on a loopback host. */
  url?: string
  /** Disable connection entirely (mock / Pages / sim mode). Defaults to false. */
  disabled?: boolean
}

export interface AgentSocketResult {
  /** Whether the WebSocket is currently open */
  connected: boolean
  /** Optional roster names from the local server */
  mcpServers: string[]
  /** Last N events received (capped at 50) */
  events: OfficeEvent[]
  /** True if the socket is unused or the local server was never reachable */
  offline: boolean
}

// ---------------------------------------------------------------------------
// Server snapshot message (sent on first connect)
// ---------------------------------------------------------------------------

interface SnapshotMessage {
  type: 'snapshot'
  activeAgents: Array<{
    id: string
    name: string
    role: string
    task?: string
    state: string
  }>
  mcpServers: string[]
  timestamp: number
}

type ServerMessage = OfficeEvent | SnapshotMessage

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 50
const BACKOFF_INITIAL = 500   // ms
const BACKOFF_MAX = 30_000    // ms
const BACKOFF_FACTOR = 2
/** Extra attempts after the first cold failure, then stop. */
const MAX_COLD_RETRIES = 2
/** Extra attempts after a drop of a socket that had opened. */
const MAX_HOT_RETRIES = 6

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentSocket(options: AgentSocketOptions = {}): AgentSocketResult {
  const {
    onEvent,
    url,
    disabled = false,
  } = options

  const hostname = currentHostname()
  const resolvedUrl = url || resolveLocalWsUrl(hostname) || ''
  const allowSocket = shouldOpenAgentSocket({
    disabled,
    url: resolvedUrl || null,
    hostname,
  })

  const [connected, setConnected]   = useState(false)
  const [mcpServers, setMcpServers] = useState<string[]>([])
  const [events, setEvents]         = useState<OfficeEvent[]>([])
  const [offline, setOffline]       = useState(!allowSocket)

  const wsRef          = useRef<WebSocket | null>(null)
  const retryCountRef  = useRef(0)
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef     = useRef(true)
  const onEventRef     = useRef(onEvent)
  const everOpenedRef  = useRef(false)
  const stoppedRef     = useRef(false)

  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const pushEvent = useCallback((event: OfficeEvent) => {
    setEvents(prev => [...prev.slice(-(MAX_EVENTS - 1)), event])
    onEventRef.current?.(event)
  }, [])

  const handleMessage = useCallback((raw: string) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    if (msg.type === 'snapshot') {
      const snap = msg as SnapshotMessage
      if (snap.mcpServers?.length) {
        setMcpServers(snap.mcpServers)
      }
      for (const agent of snap.activeAgents ?? []) {
        const event: OfficeEvent = {
          type: 'agent_spawned',
          agent: {
            id:   agent.id,
            name: agent.name,
            role: agent.role,
            task: agent.task,
          },
        }
        pushEvent(event)
      }
      return
    }

    pushEvent(msg as OfficeEvent)
  }, [pushEvent])

  useEffect(() => {
    mountedRef.current = true
    retryCountRef.current = 0
    everOpenedRef.current = false
    stoppedRef.current = false

    if (!allowSocket || !resolvedUrl) {
      setConnected(false)
      setOffline(true)
      return () => {
        mountedRef.current = false
      }
    }

    const rosterUrl = resolveLocalRosterUrl()

    const fetchRoster = async () => {
      if (!rosterUrl) return
      try {
        const res = await fetch(rosterUrl, { signal: AbortSignal.timeout(2000) })
        if (!res.ok) return
        const data = await res.json()
        if (mountedRef.current && Array.isArray(data.mcpServers)) {
          setMcpServers(data.mcpServers)
        }
      } catch {
        // Local server not reachable — roster may arrive via snapshot instead.
      }
    }

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }

    const dropSocket = () => {
      if (!wsRef.current) return
      wsRef.current.onopen    = null
      wsRef.current.onmessage = null
      wsRef.current.onclose   = null
      wsRef.current.onerror   = null
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
    }

    const scheduleReconnect = () => {
      if (!mountedRef.current || stoppedRef.current) return

      const max = everOpenedRef.current ? MAX_HOT_RETRIES : MAX_COLD_RETRIES
      if (retryCountRef.current >= max) {
        stoppedRef.current = true
        setOffline(true)
        return
      }

      clearRetry()
      const delay = Math.min(
        BACKOFF_INITIAL * Math.pow(BACKOFF_FACTOR, retryCountRef.current),
        BACKOFF_MAX,
      )
      retryCountRef.current += 1
      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current && !stoppedRef.current) connect()
      }, delay)
    }

    const connect = () => {
      if (!mountedRef.current || stoppedRef.current) return
      dropSocket()

      let ws: WebSocket
      try {
        ws = new WebSocket(resolvedUrl)
      } catch {
        scheduleReconnect()
        return
      }

      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        everOpenedRef.current = true
        retryCountRef.current = 0
        stoppedRef.current = false
        setConnected(true)
        setOffline(false)
        void fetchRoster()
      }

      ws.onmessage = (evt) => {
        if (!mountedRef.current) return
        handleMessage(String(evt.data))
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(false)
        scheduleReconnect()
      }

      ws.onerror = () => {
        if (retryCountRef.current === 0 && !everOpenedRef.current) {
          setOffline(true)
        }
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      stoppedRef.current = true
      clearRetry()
      dropSocket()
    }
  }, [allowSocket, resolvedUrl, handleMessage])

  return { connected, mcpServers, events, offline }
}
