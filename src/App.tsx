import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import './styles/office.css'
import './styles/rooms.css'
import SlackChat, { ChatMessage } from './components/SlackChat'
import Character from './components/Character'
import FurnitureRenderer from './components/FurnitureRenderer'
import { Agent, OfficeEvent, AGENT_CONFIGS } from './types'
import { getCurrentPhase, getPhaseLabel, type DayPhase } from './daylight'
import { ROOMS } from './rooms'
import { useAgentSocket } from './hooks/useAgentSocket'
import * as sfx from './sounds'
import {
  stepToward,
  findWaypointPath,
  WALK_SPEED,
  BREAK_DURATION,
  workMessage,
} from './agentManager'
import {
  PRODUCT, DOMAIN, MODE_LABEL, STATUS_URL,
  shouldUseLocalAgentSocket, resolveLocalWsUrl, resolveLocalChatUrl,
} from './config'
import { getInteraction } from './interactions'
import { getRoomImage } from './theme'
import {
  OPERATORS, COORD_ID, PERMANENT_IDS, DEFAULT_STATUS_URLS,
} from './operators'
import {
  applyRecordToAgent,
  dutyToAgentState,
  fetchStatusWithFallback,
  normalizeStatusPayload,
  resolveStatusUrl,
  type NormalizedRecord,
} from './statusAdapter'

const PlacementHelper = lazy(() => import('./components/PlacementHelper'))
const params = new URLSearchParams(window.location.search)
const isHelperMode = params.has('helper')
const isSimMode = params.has('sim') || params.has('video')

function timeNow(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

let nextMsgId = 1
function makeMsgId() { return nextMsgId++ }

const MAIN_ROOM = ROOMS['main-office']
const ENTRY = MAIN_ROOM.entryPoint
const COFFEE_SPOT = MAIN_ROOM.agentSpots.find(s => s.type === 'coffee') ?? null
const DOOR_TARGET = { x: ENTRY.x, y: ENTRY.y }
const MAIN_WAYPOINTS = MAIN_ROOM.waypoints ?? []

function computePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  if (MAIN_WAYPOINTS.length === 0) return []
  return findWaypointPath(from.x, from.y, to.x, to.y, MAIN_WAYPOINTS)
}

const ARRIVAL_THRESHOLD = 0.3

interface AgentMeta {
  spawnedAt: number
  arrivedAtDeskAt: number | null
  idleSince: number | null
  onBreak: boolean
  breakStartedAt: number | null
}

type SfxEffect = 'doorOpen' | 'typing' | 'celebration' | 'coffee' | 'alarm' | 'error' | 'powerDown' | 'notification'

interface PendingEffect {
  msg?: { sender: string; role: string; color: string; text: string; isSystem?: boolean }
  sfx?: SfxEffect
  furnitureState?: { id: string; state: string }
}

function createOperator(op = OPERATORS[0], staggerMs = 0): Agent {
  const spot = MAIN_ROOM.agentSpots.find(s => s.id === op.spotId)
    ?? MAIN_ROOM.agentSpots.find(s => s.type === 'desk')
    ?? { id: op.spotId, type: 'desk' as const, x: 28.9, y: 66 }
  const entry = MAIN_ROOM.entryPoint
  const target = { x: spot.x, y: spot.y }
  return {
    id: op.id,
    name: op.name,
    type: 'subagent',
    role: op.role,
    state: 'new-hire',
    position: { x: entry.x, y: entry.y },
    targetPosition: target,
    deskPosition: target,
    room: 'main-office',
    assignedRoom: 'main-office',
    assignedSpotId: spot.id,
    spriteFacing: 'spriteFacing' in spot ? spot.spriteFacing : undefined,
    task: op.role,
    statusText: 'clocked in',
    color: op.color,
    emoji: op.emoji,
    hiredAt: Date.now() + staggerMs,
    pathQueue: computePath(entry, target),
    dutyStatus: 'idle',
    progress: 0,
    companion: op.companion,
    companionId: op.companionId,
    present: true,
  }
}

function seedOperators(): Agent[] {
  return OPERATORS.map((op, i) => createOperator(op, i * 400))
}

function statusUrls(): string[] {
  const primary = resolveStatusUrl()
  const extras = DEFAULT_STATUS_URLS.filter(u => u !== primary)
  return [primary, ...extras, './status.json']
}

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(() => seedOperators())
  const agentMetaRef = useRef<Map<string, AgentMeta>>(new Map(
    OPERATORS.map(op => [op.id, {
      spawnedAt: Date.now(), arrivedAtDeskAt: null, idleSince: null, onBreak: false, breakStartedAt: null,
    }]),
  ))

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatTypingUser, setChatTypingUser] = useState<string | null>(null)
  const [lastSeenId, setLastSeenId] = useState<number | null>(null)
  const [muted, setMuted] = useState(true)
  const [dayPhase, setDayPhase] = useState<DayPhase>(getCurrentPhase())
  const [dayNightMode, setDayNightMode] = useState<'auto' | 'day' | 'night'>('auto')
  const [nightOpacity, setNightOpacity] = useState(0)
  const [furnitureStates, setFurnitureStates] = useState<Record<string, string>>({})
  const [flickering, setFlickering] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [liveFeed, setLiveFeed] = useState(!isSimMode)
  const [feedSource, setFeedSource] = useState<string | null>(isSimMode ? 'sim' : null)
  const [ticker, setTicker] = useState('Paper research only — no trades')

  const interactionCooldowns = useRef<Map<string, number>>(new Map())
  const [coordEffect, setCoordEffect] = useState<string | null>(null)
  const printsRef = useRef<Map<string, string>>(new Map())

  const agentsRef = useRef<Agent[]>([])
  agentsRef.current = agents
  const pendingEffectsRef = useRef<PendingEffect[]>([])
  const recentChatKeysRef = useRef<Set<string>>(new Set())
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set())
  const [autoTypeText, setAutoTypeText] = useState<string | undefined>(undefined)

  const addMsg = useCallback((
    sender: string,
    role: string,
    color: string,
    text: string,
    isSystem = false,
  ) => {
    setMessages(prev => [...prev.slice(-50), {
      id: makeMsgId(),
      sender,
      senderSprite: role,
      senderColor: color,
      text,
      channel: 'hq-floor',
      timestamp: timeNow(),
      isSystem,
    }])
  }, [])

  const applyRecords = useCallback((changed: NormalizedRecord[]) => {
    if (changed.length === 0) return
    const effects: PendingEffect[] = []

    setAgents(prev => {
      let next = [...prev]
      for (const rec of changed) {
        const idx = next.findIndex(a => a.id === rec.id)
        const existing = idx >= 0 ? next[idx] : null
        if (!existing) continue
        const applied = applyRecordToAgent(existing, rec, undefined)
        if (!applied.restartAnim && applied.agent === existing) continue

        let agent = applied.agent
        const spawned = applied.events.some(e => e.type === 'agent_spawned')
        if (spawned) {
          agent = {
            ...agent,
            position: { ...ENTRY },
            targetPosition: { ...agent.deskPosition },
            pathQueue: computePath(ENTRY, agent.deskPosition),
            state: 'new-hire',
          }
        } else if (agent.state === 'completed' && rec.status === 'offline') {
          agent = {
            ...agent,
            targetPosition: { ...DOOR_TARGET },
            pathQueue: computePath(agent.position, DOOR_TARGET),
          }
        } else if (agent.state === 'walking-to-desk' && (!agent.pathQueue || agent.pathQueue.length === 0)) {
          agent = {
            ...agent,
            targetPosition: { ...agent.deskPosition },
            pathQueue: computePath(agent.position, agent.deskPosition),
          }
        } else if (rec.status === 'done' && agent.state !== 'new-hire' && agent.state !== 'walking-to-desk') {
          agent = { ...agent, cueKey: `done:${rec.updatedAt}`, state: 'idle' }
        }

        next[idx] = agent
        if (applied.chat) {
          effects.push({
            msg: { sender: agent.name, role: agent.role, color: agent.color, text: applied.chat },
            sfx: applied.sfx ?? undefined,
          })
        } else if (applied.sfx) {
          effects.push({ sfx: applied.sfx })
        }
      }
      return next
    })

    pendingEffectsRef.current.push(...effects)
  }, [])

  const handleFurnitureClick = useCallback((itemId: string) => {
    const interaction = getInteraction(itemId)
    if (!interaction) return
    const now = Date.now()
    const lastUsed = interactionCooldowns.current.get(itemId) ?? 0
    if (now - lastUsed < interaction.cooldown) return
    interactionCooldowns.current.set(itemId, now)

    const target = interaction.walkTo
    setAgents(prev => prev.map(a => {
      if (a.id !== COORD_ID) return a
      return {
        ...a,
        state: 'walking-to-desk' as const,
        targetPosition: target,
        pathQueue: computePath(a.position, target),
        statusText: Array.isArray(interaction.chatMessage)
          ? interaction.chatMessage[0]
          : interaction.chatMessage,
      }
    }))

    const checkArrival = setInterval(() => {
      const coord = agentsRef.current.find(a => a.id === COORD_ID)
      if (!coord) { clearInterval(checkArrival); return }
      const dist = Math.sqrt((coord.position.x - target.x) ** 2 + (coord.position.y - target.y) ** 2)
      if (dist < 2) {
        clearInterval(checkArrival)
        if (interaction.sound === 'bell') sfx.playBell()
        else if (interaction.sound === 'notification') sfx.playNotification()
        else if (interaction.sound === 'coffee') sfx.playCoffee()
        setCoordEffect(interaction.effect)
        setTimeout(() => setCoordEffect(null), interaction.duration)
        const msg = Array.isArray(interaction.chatMessage)
          ? interaction.chatMessage[0]
          : interaction.chatMessage
        addMsg('New Bot', 'Coordinator', '#fda4af', msg)
        if (interaction.furnitureState) {
          const fs = interaction.furnitureState
          setFurnitureStates(prev => ({ ...prev, [fs.id]: fs.state }))
          if (fs.revertAfter) {
            setTimeout(() => {
              setFurnitureStates(prev => {
                const n = { ...prev }
                delete n[fs.id]
                return n
              })
            }, fs.revertAfter)
          }
        }
        setTimeout(() => {
          setAgents(prev => prev.map(a => {
            if (a.id !== COORD_ID) return a
            return {
              ...a,
              state: 'walking-to-desk' as const,
              targetPosition: { ...a.deskPosition },
              pathQueue: computePath(a.position, a.deskPosition),
              statusText: 'back to desk',
            }
          }))
        }, interaction.duration + 500)
      }
    }, 200)
    setTimeout(() => clearInterval(checkArrival), 15000)
  }, [addMsg])

  useEffect(() => {
    const effects = pendingEffectsRef.current
    if (effects.length === 0) return
    pendingEffectsRef.current = []
    for (const fx of effects) {
      if (fx.msg && !fx.msg.isSystem) {
        const role = fx.msg.role
        const agentId = agents.find(a => a.role === role || a.name === fx.msg!.sender)?.id
        if (agentId) {
          setTypingAgents(prev => new Set(prev).add(agentId))
          setTimeout(() => {
            setTypingAgents(prev => {
              const next = new Set(prev)
              next.delete(agentId)
              return next
            })
            addMsg(fx.msg!.sender, fx.msg!.role, fx.msg!.color, fx.msg!.text, fx.msg!.isSystem)
          }, 500)
        } else {
          addMsg(fx.msg.sender, fx.msg.role, fx.msg.color, fx.msg.text, fx.msg.isSystem)
        }
      } else if (fx.msg) {
        addMsg(fx.msg.sender, fx.msg.role, fx.msg.color, fx.msg.text, fx.msg.isSystem)
      }
      if (fx.sfx && !sfx.isMuted()) {
        switch (fx.sfx) {
          case 'doorOpen':    sfx.playDoorOpen(); break
          case 'typing':      sfx.playTyping(); break
          case 'celebration': sfx.playCelebration(); break
          case 'coffee':      sfx.playCoffee(); break
          case 'alarm':       sfx.playAlarm(); break
          case 'error':       sfx.playError(); break
          case 'powerDown':   sfx.playPowerDown(); break
          case 'notification': sfx.playNotification(); break
        }
      }
      if (fx.furnitureState) {
        setFurnitureStates(prev => ({ ...prev, [fx.furnitureState!.id]: fx.furnitureState!.state }))
      }
    }
  })

  useEffect(() => {
    const CYCLE_MS = 10 * 60 * 1000
    const startTime = Date.now()
    let lastPhase: DayPhase | null = null
    const tick = () => {
      const t = ((Date.now() - startTime) % CYCLE_MS) / 1000
      let opacity: number
      let phase: DayPhase
      if (t < 60) { opacity = 1 - (t / 60); phase = 'dawn' }
      else if (t < 300) { opacity = 0; phase = t < 180 ? 'morning' : 'afternoon' }
      else if (t < 360) { opacity = (t - 300) / 60; phase = 'dusk' }
      else { opacity = 1; phase = 'night' }
      setNightOpacity(opacity)
      if (phase !== lastPhase) { lastPhase = phase; setDayPhase(phase) }
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [])

  const handleEvent = useCallback((event: OfficeEvent) => {
    if (event.type === 'chat_typing') {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      setChatTypingUser(event.sender ?? '')
      typingTimeoutRef.current = setTimeout(() => setChatTypingUser(null), 10000)
      return
    }
    if (event.type === 'chat_reaction') {
      const { messageId, reactions } = event as OfficeEvent & { messageId?: number; reactions?: string[] }
      if (messageId && reactions) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m))
      }
      return
    }
    if (event.type === 'chat_seen') {
      setLastSeenId((event as OfficeEvent & { messageId?: number }).messageId ?? null)
      return
    }
    if (event.type === 'chat_message') {
      const sender = event.sender ?? 'Operator'
      const text = event.text ?? ''
      const ts = (event as OfficeEvent & { timestamp?: number }).timestamp
      setChatTypingUser(null)
      if (sender.toLowerCase() === 'new bot') return
      const dedupKey = `${ts ?? 0}:${text}`
      if (recentChatKeysRef.current.has(dedupKey)) return
      recentChatKeysRef.current.add(dedupKey)
      const match = agentsRef.current.find(a =>
        a.name.toLowerCase() === sender.toLowerCase() || a.id === sender.toLowerCase(),
      )
      addMsg(match?.name ?? sender, match?.role ?? sender, match?.color ?? '#95a5a6', text)
      return
    }

    // Extra spawn events from leftover hook producers are ignored — roster is fixed at five.
    if (event.type === 'agent_spawned') {
      const id = event.agent?.id
      if (!id || !PERMANENT_IDS.has(id)) return
    }
    if (event.type === 'agent_working' || event.type === 'agent_completed') {
      const id = event.agentId ?? event.agent?.id
      if (!id || !PERMANENT_IDS.has(id)) return
      const rec: NormalizedRecord = {
        id,
        name: event.agent?.name ?? id,
        role: event.agent?.role ?? '',
        status: event.type === 'agent_completed' ? 'done' : 'working',
        task: event.agent?.task ?? event.status ?? '',
        progress: event.type === 'agent_completed' ? 100 : 50,
        lastAction: event.status ?? event.result ?? '',
        updatedAt: new Date().toISOString(),
        companion: '',
        companionId: '',
        color: '',
        present: true,
      }
      applyRecords([rec])
    }
  }, [addMsg, applyRecords])

  const localSocket = shouldUseLocalAgentSocket()
  useAgentSocket({
    onEvent: handleEvent,
    url: resolveLocalWsUrl() ?? undefined,
    disabled: isSimMode || !localSocket,
  })

  // Live status.json poll — primary ingestion. Identical ticks are no-ops.
  useEffect(() => {
    if (isSimMode) return
    let cancelled = false
    const poll = async () => {
      try {
        const { url, data } = await fetchStatusWithFallback(statusUrls())
        if (cancelled) return
        const records = normalizeStatusPayload(data)
        const raw = data as { ticker?: string[]; office_mood?: string }
        if (Array.isArray(raw.ticker) && raw.ticker[0]) setTicker(raw.ticker[0])
        const changed: NormalizedRecord[] = []
        for (const rec of records) {
          const fp = [rec.id, rec.status, rec.task, String(rec.progress), rec.lastAction].join('|')
          if (printsRef.current.get(rec.id) === fp) continue
          printsRef.current.set(rec.id, fp)
          changed.push(rec)
        }
        if (changed.length) applyRecords(changed)
        setLiveFeed(true)
        setFeedSource(url)
      } catch {
        setLiveFeed(false)
      }
    }
    void poll()
    const id = setInterval(() => { void poll() }, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [applyRecords])

  // Deterministic ?sim task sequence — five operators only, no extra hires.
  useEffect(() => {
    if (!isSimMode) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)) }

    at(400, () => addMsg('system', 'default', '#8b8d91', 'SIM — paper research floor', true))
    at(900, () => addMsg('New Bot', 'Coordinator', '#fda4af', 'Command center live — paper research only'))
    at(1600, () => applyRecords([{
      id: 'new-bot', name: 'New Bot', role: 'Coordinator', status: 'working',
      task: 'Coordinate + report to Jack', progress: 90,
      lastAction: 'Command center live · waiting on Jack',
      updatedAt: '2026-09-15T18:40:00Z', companion: 'Bunbot', companionId: 'bunbot',
      color: '#fda4af', present: true,
    }]))
    at(2400, () => applyRecords([{
      id: 'mira', name: 'Mira', role: 'Research / Forensics', status: 'working',
      task: 'Watchlist token forensics', progress: 72,
      lastAction: 'Scan pass 4 of 5',
      updatedAt: '2026-09-15T18:41:02Z', companion: 'Scanslime', companionId: 'scanslime',
      color: '#7dd3fc', present: true,
    }]))
    at(2800, () => addMsg('Mira', 'Research / Forensics', '#7dd3fc', 'Watchlist token forensics — scan pass 4 of 5'))
    at(3600, () => applyRecords([{
      id: 'kai', name: 'Kai', role: 'Analysis / Clustering', status: 'idle',
      task: 'Early-buyer cluster module', progress: 100,
      lastAction: 'Parked after demo',
      updatedAt: '2026-09-15T18:40:00Z', companion: 'Foldfox', companionId: 'foldfox',
      color: '#c4b5fd', present: true,
    }]))
    at(4200, () => applyRecords([{
      id: 'oak', name: 'Oak', role: 'Monitoring / Watch', status: 'idle',
      task: 'Paper watchlist', progress: 100,
      lastAction: 'Monitoring · no alerts',
      updatedAt: '2026-09-15T18:40:00Z', companion: 'Voltbug', companionId: 'voltbug',
      color: '#86efac', present: true,
    }]))
    at(4800, () => applyRecords([{
      id: 'rex', name: 'Rex', role: 'Review / Archive', status: 'idle',
      task: 'Alpha lab archive', progress: 100,
      lastAction: 'Ledger parked',
      updatedAt: '2026-09-15T18:40:00Z', companion: 'Archivowl', companionId: 'archivowl',
      color: '#fcd34d', present: true,
    }]))
    at(6200, () => applyRecords([{
      id: 'mira', name: 'Mira', role: 'Research / Forensics', status: 'running_tool',
      task: 'Watchlist token forensics', progress: 80,
      lastAction: 'Scan pass 5 of 5',
      updatedAt: '2026-09-15T18:41:20Z', companion: 'Scanslime', companionId: 'scanslime',
      color: '#7dd3fc', present: true,
    }]))
    at(6600, () => addMsg('Mira', 'Research / Forensics', '#7dd3fc', 'Scan pass 5 of 5'))
    at(9000, () => applyRecords([{
      id: 'mira', name: 'Mira', role: 'Research / Forensics', status: 'needs_approval',
      task: 'Watchlist token forensics', progress: 92,
      lastAction: 'Packet ready for review',
      updatedAt: '2026-09-15T18:41:40Z', companion: 'Scanslime', companionId: 'scanslime',
      color: '#7dd3fc', present: true,
    }]))
    at(9400, () => addMsg('Mira', 'Research / Forensics', '#7dd3fc', 'Packet ready for review'))
    at(11000, () => applyRecords([{
      id: 'rex', name: 'Rex', role: 'Review / Archive', status: 'working',
      task: 'Alpha lab archive', progress: 40,
      lastAction: 'Filing Mira packet',
      updatedAt: '2026-09-15T18:41:55Z', companion: 'Archivowl', companionId: 'archivowl',
      color: '#fcd34d', present: true,
    }]))
    at(13000, () => applyRecords([{
      id: 'mira', name: 'Mira', role: 'Research / Forensics', status: 'done',
      task: 'Watchlist token forensics', progress: 100,
      lastAction: 'Scan complete',
      updatedAt: '2026-09-15T18:42:10Z', companion: 'Scanslime', companionId: 'scanslime',
      color: '#7dd3fc', present: true,
    }]))
    at(15000, () => applyRecords([{
      id: 'mira', name: 'Mira', role: 'Research / Forensics', status: 'idle',
      task: 'Watchlist token forensics', progress: 100,
      lastAction: 'Parked — paper only',
      updatedAt: '2026-09-15T18:42:20Z', companion: 'Scanslime', companionId: 'scanslime',
      color: '#7dd3fc', present: true,
    }]))

    return () => timers.forEach(clearTimeout)
  }, [addMsg, applyRecords])

  // Animation loop — donor pathfinding / interpolation unchanged
  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const prev = agentsRef.current
      if (prev.length === 0) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const nowMs = Date.now()
      let changed = false

      const next = prev.map(agent => {
        const meta = agentMetaRef.current.get(agent.id) ?? {
          spawnedAt: Date.now(), arrivedAtDeskAt: null, idleSince: null, onBreak: false, breakStartedAt: null,
        }
        agentMetaRef.current.set(agent.id, meta)
        const speed = WALK_SPEED * dt
        const queue = agent.pathQueue ?? []
        const immediateTarget = queue.length > 0 ? queue[0] : agent.targetPosition
        const { position, arrived } = stepToward(agent.position, immediateTarget, speed)
        const moved = position.x !== agent.position.x || position.y !== agent.position.y
        let updated: Agent = moved ? (changed = true, { ...agent, position }) : agent

        if (arrived) {
          if (queue.length > 0) {
            updated = { ...agent, position, pathQueue: queue.slice(1) }
            changed = true
          } else {
            const isAtDesk = (
              Math.abs(agent.targetPosition.x - agent.deskPosition.x) < ARRIVAL_THRESHOLD &&
              Math.abs(agent.targetPosition.y - agent.deskPosition.y) < ARRIVAL_THRESHOLD
            )
            const isAtDoor = (
              Math.abs(agent.targetPosition.x - DOOR_TARGET.x) < ARRIVAL_THRESHOLD &&
              Math.abs(agent.targetPosition.y - DOOR_TARGET.y) < ARRIVAL_THRESHOLD
            )

            if (agent.state === 'new-hire' || agent.state === 'walking-to-desk') {
              if (isAtDesk || agent.state === 'new-hire') {
                meta.arrivedAtDeskAt = nowMs
                meta.onBreak = false
                const seated = dutyToAgentState(agent.dutyStatus ?? 'idle')
                updated = {
                  ...agent,
                  position,
                  state: seated === 'completed' ? 'idle' : seated,
                }
                changed = true
              }
            } else if (agent.state === 'completed' && isAtDoor) {
              updated = { ...agent, position, present: false }
              changed = true
            } else if (agent.state === 'coffee-break') {
              if (!meta.onBreak) {
                meta.onBreak = true
                meta.breakStartedAt = nowMs
                if (COFFEE_SPOT !== null) {
                  const atCoffee = Math.abs(position.x - COFFEE_SPOT.x) < 3 && Math.abs(position.y - COFFEE_SPOT.y) < 3
                  if (atCoffee) setFurnitureStates(fs => ({ ...fs, coffee: 'on' }))
                }
                updated = { ...agent, position }
                changed = true
              } else if (nowMs - (meta.breakStartedAt ?? nowMs) >= BREAK_DURATION) {
                meta.onBreak = false
                meta.breakStartedAt = null
                meta.arrivedAtDeskAt = nowMs
                setFurnitureStates(fs => ({ ...fs, coffee: 'off' }))
                updated = {
                  ...agent,
                  position,
                  state: 'walking-to-desk',
                  targetPosition: { ...agent.deskPosition },
                  statusText: workMessage(),
                  pathQueue: computePath(position, agent.deskPosition),
                }
                changed = true
              }
            } else if (moved) {
              updated = { ...agent, position }
              changed = true
            }
          }
        }
        return updated
      })

      if (changed) setAgents(next)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // No ambient / keyboard loops unless the user unmutes
  useEffect(() => {
    if (muted) {
      sfx.stopAmbient()
      return
    }
    sfx.playAmbientHum()
    return () => sfx.stopAmbient()
  }, [muted])

  const effectivePhase: DayPhase = dayNightMode === 'auto' ? dayPhase
    : dayNightMode === 'day' ? 'morning' : 'night'
  const isNight = effectivePhase === 'night' || effectivePhase === 'dusk'
  const [volume, setVolume] = useState(sfx.getVolume())

  const handleToggleMute = useCallback(() => {
    const nowMuted = sfx.toggleMute()
    setMuted(nowMuted)
    setVolume(sfx.getVolume())
  }, [])

  const handleVolumeChange = useCallback((v: number) => {
    sfx.setVolume(v)
    setVolume(v)
    setMuted(v === 0)
  }, [])

  const present = agents.filter(a => a.present !== false)
  const activeCount = present.filter(a => a.dutyStatus === 'working' || a.dutyStatus === 'running_tool' || a.dutyStatus === 'reading' || a.dutyStatus === 'thinking').length
  const needsYou = present.filter(a => a.dutyStatus === 'needs_approval')
  const selected = agents.find(a => a.id === selectedId) ?? null

  if (isHelperMode) {
    return (
      <Suspense fallback={<div style={{ color: '#666', padding: 20 }}>Loading helper...</div>}>
        <PlacementHelper />
      </Suspense>
    )
  }

  return (
    <div className="app-wrapper nbhq">
      <div className="title-bar nbhq-bar">
        <span className="nbhq-brand">{PRODUCT}</span>
        <span className={`nbhq-live${liveFeed || isSimMode ? ' on' : ''}`}>
          {isSimMode ? 'SIM' : liveFeed ? 'LIVE' : 'OFFLINE'}
        </span>
        <span className="nbhq-stat">{activeCount} active</span>
        <button
          type="button"
          className={`nbhq-needs${needsYou.length ? ' hot' : ''}`}
          onClick={() => setApprovalOpen(o => !o)}
        >
          Needs You {needsYou.length}
        </button>
        <span className="nbhq-mode">{MODE_LABEL}</span>
        <span className="nbhq-domain">{DOMAIN}</span>
        <button
          className="title-bar-daynight"
          onClick={() => setDayNightMode(prev =>
            prev === 'auto' ? 'day' : prev === 'day' ? 'night' : 'auto',
          )}
          title={`Mode: ${dayNightMode}`}
        >
          {dayNightMode === 'auto' ? 'AUTO' : dayNightMode === 'day' ? 'DAY' : 'NIGHT'}
        </button>
        <span className="title-bar-phase">{getPhaseLabel(effectivePhase)}</span>
      </div>

      <div className="app-body">
      <div className="office-view" onClick={() => setSelectedId(null)}>
        <div
          className={`room-container${flickering ? ' flickering' : ''}`}
          style={{
            aspectRatio: '4800/3584',
            width: '100%',
            maxHeight: '100%',
            position: 'relative',
          }}
        >
          <div
            className="room-background"
            style={{ backgroundImage: `url(${getRoomImage('day')})` }}
          />
          <div
            className="room-background room-background-night"
            style={{
              backgroundImage: `url(${getRoomImage('night')})`,
              opacity: dayNightMode === 'auto' ? nightOpacity : dayNightMode === 'night' ? 1 : 0,
            }}
          />

          <FurnitureRenderer onItemClick={handleFurnitureClick} items={MAIN_ROOM.furniture.map(item => {
            const stateOverride = furnitureStates[item.id]
            if (!stateOverride) return item
            if (item.id === 'coffee' && stateOverride === 'on') return { ...item, sprite: 'coffee-on' }
            if (item.id === 'filing-1' && stateOverride === 'open') return { ...item, sprite: 'filing-open' }
            if (item.id === 'printer-1' && stateOverride === 'broken') return { ...item, sprite: 'printer-broken' }
            return item
          })} />

          {agents.map(agent => {
            const spot = MAIN_ROOM.agentSpots.find(s => s.id === agent.assignedSpotId)
            const atDesk = Math.abs(agent.position.x - agent.deskPosition.x) < 1 &&
                           Math.abs(agent.position.y - agent.deskPosition.y) < 1
            const zOverride = atDesk && spot?.zIndex ? spot.zIndex : undefined
            const meta = agentMetaRef.current.get(agent.id)
            const idleDurationMs =
              agent.state === 'idle' && meta?.idleSince
                ? Date.now() - meta.idleSince
                : 0
            return (
              <Character
                key={agent.id}
                agent={agent}
                idleDurationMs={idleDurationMs}
                zIndex={zOverride}
                isTyping={typingAgents.has(agent.id) || agent.dutyStatus === 'working' || agent.dutyStatus === 'running_tool'}
                selected={selectedId === agent.id}
                onSelect={setSelectedId}
              />
            )
          })}

          {coordEffect && (() => {
            const coord = agents.find(a => a.id === COORD_ID)
            if (!coord) return null
            return (
              <div
                className="boss-interaction-effect"
                style={{
                  position: 'absolute',
                  left: `${coord.position.x}%`,
                  top: `${coord.position.y - 8}%`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: 999,
                  pointerEvents: 'none',
                }}
              >
                <img
                  src={coordEffect}
                  alt="interaction"
                  style={{ height: 32, width: 'auto', imageRendering: 'pixelated' }}
                />
              </div>
            )
          })()}

          <div className={`day-overlay ${effectivePhase}`} />
        </div>

        {selected && (
          <aside className="nbhq-detail" onClick={e => e.stopPropagation()}>
            <div className="nbhq-detail-name" style={{ color: selected.color }}>{selected.name}</div>
            <div className="nbhq-detail-role">{selected.role}</div>
            <div className="nbhq-detail-row">Status <b>{selected.dutyStatus ?? selected.state}</b></div>
            {selected.task && <div className="nbhq-detail-row">Task {selected.task}</div>}
            {typeof selected.progress === 'number' && (
              <div className="nbhq-detail-row">Progress {selected.progress}%</div>
            )}
            {selected.lastAction && <div className="nbhq-detail-row">{selected.lastAction}</div>}
            {selected.companion && (
              <div className="nbhq-detail-companion">
                {selected.companionId && (
                  <img src={`/sprites/companions/${selected.companionId}.png`} alt={selected.companion} />
                )}
                <span>Companion {selected.companion}</span>
              </div>
            )}
          </aside>
        )}

        {approvalOpen && (
          <aside className="nbhq-approval" onClick={e => e.stopPropagation()}>
            <div className="nbhq-approval-title">Needs You</div>
            {needsYou.length === 0 && <div className="nbhq-detail-row">No approvals waiting</div>}
            {needsYou.map(a => (
              <button key={a.id} type="button" className="nbhq-approval-item" onClick={() => setSelectedId(a.id)}>
                <span style={{ color: a.color }}>{a.name}</span>
                <span>{a.lastAction || a.task}</span>
              </button>
            ))}
          </aside>
        )}
      </div>

      <SlackChat
        messages={messages}
        muted={muted}
        volume={volume}
        onToggleMute={handleToggleMute}
        onVolumeChange={handleVolumeChange}
        onSendMessage={(text) => {
          addMsg('New Bot', 'Coordinator', '#fda4af', text)
          setAutoTypeText(undefined)
          const chatUrl = resolveLocalChatUrl()
          if (!chatUrl) return
          fetch(chatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: 'New Bot', text }),
          }).catch(() => {})
        }}
        autoTypeText={autoTypeText}
        dayPhase={effectivePhase}
        typingUser={chatTypingUser}
        lastSeenId={lastSeenId}
        onReaction={(messageId, reactions) => {
          setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, reactions } : m
          ))
        }}
      />
      </div>
      <div className="nbhq-ticker">{ticker}{feedSource && feedSource !== 'sim' ? ` · ${feedSource.replace('https://', '')}` : ''}</div>
      <span className="sr-only">{STATUS_URL}{isNight ? ' night' : ''}</span>
    </div>
  )
}

export default App
