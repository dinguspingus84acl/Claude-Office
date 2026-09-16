import type { RoomId } from './rooms'

export type AgentState =
  | 'idle'
  | 'walking-to-manager'
  | 'talking-to-manager'
  | 'walking-to-desk'
  | 'working'
  | 'coffee-break'
  | 'completed'
  | 'new-hire'
  | 'changing-room'

export type DutyStatus =
  | 'offline'
  | 'idle'
  | 'reading'
  | 'thinking'
  | 'working'
  | 'running_tool'
  | 'waiting'
  | 'needs_approval'
  | 'blocked'
  | 'done'
  | 'failed'

export interface Position {
  x: number
  y: number
}

export interface Agent {
  id: string
  name: string
  type: 'subagent' | 'mcp'
  role: string
  state: AgentState
  position: Position
  targetPosition: Position
  deskPosition: Position
  room: RoomId
  assignedRoom: RoomId
  assignedSpotId?: string
  task?: string
  statusText?: string
  spriteFacing?: 'front-left' | 'front-right' | 'rear-left' | 'rear-right'
  color: string
  emoji: string
  hiredAt: number
  pathQueue?: { x: number; y: number }[]
  dutyStatus?: DutyStatus
  progress?: number
  companion?: string
  companionId?: string
  lastAction?: string
  updatedAt?: string
  present?: boolean
  cueKey?: string
}

export interface OfficeEvent {
  type: 'agent_spawned' | 'agent_working' | 'agent_completed' | 'mcp_call' | 'mcp_done' | 'new_hire' | 'chat_message' | 'chat_typing' | 'chat_reaction' | 'chat_seen' | 'duty_update'
  agent?: Partial<Agent>
  agentId?: string
  status?: string
  result?: string
  sender?: string
  text?: string
}

import { OPERATORS } from './operators'

export const AGENT_CONFIGS: Record<string, { color: string; emoji: string; title: string }> = {
  default: { color: '#95a5a6', emoji: '👤', title: 'Operator' },
}

for (const op of OPERATORS) {
  AGENT_CONFIGS[op.id] = { color: op.color, emoji: op.emoji, title: op.name }
  AGENT_CONFIGS[op.roleKey] = { color: op.color, emoji: op.emoji, title: op.name }
  AGENT_CONFIGS[op.role] = { color: op.color, emoji: op.emoji, title: op.name }
}
