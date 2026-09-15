/**
 * Five permanent New Bot HQ operators mapped onto existing donor desk slots.
 * Do not add rooms, desks, or extra walking characters.
 */

import type { Agent } from './types'
import type { DutyStatus } from './types'

export const PRODUCT_NAME = 'New Bot HQ'
export const PRODUCT_DOMAIN = 'grokbottech.com'
export const PRODUCT_MODE = 'PAPER RESEARCH ONLY'
export const PRODUCT_MODE_KEY = 'PAPER_RESEARCH_ONLY'

export const DEFAULT_STATUS_URLS = [
  'https://dinguspingus84acl.github.io/new-bot-hq/status.json',
  'https://raw.githubusercontent.com/dinguspingus84acl/new-bot-hq/main/status.json',
  './status.json',
]

export interface OperatorDef {
  id: string
  aliases: string[]
  name: string
  role: string
  roleKey: string
  companion: string
  companionId: string
  color: string
  emoji: string
  /** Existing donor workstation slot — do not invent new desks */
  spotId: string
  /** Donor directional sprite base in /sprites/characters/ */
  sprite: string
}

export const OPERATORS: OperatorDef[] = [
  {
    id: 'new-bot',
    aliases: ['coord', 'coordinator', 'new bot', 'newbot'],
    name: 'New Bot',
    role: 'Coordinator',
    roleKey: 'coordinator',
    companion: 'Bunbot',
    companionId: 'bunbot',
    color: '#fda4af',
    emoji: '🤖',
    spotId: 'spot-1',
    sprite: 'Me-1',
  },
  {
    id: 'mira',
    aliases: ['deep', 'research', 'forensics'],
    name: 'Mira',
    role: 'Research / Forensics',
    roleKey: 'research',
    companion: 'Scanslime',
    companionId: 'scanslime',
    color: '#7dd3fc',
    emoji: '🕵️',
    spotId: 'spot-2',
    sprite: 'explore-1',
  },
  {
    id: 'kai',
    aliases: ['cluster', 'analysis', 'clustering'],
    name: 'Kai',
    role: 'Analysis / Clustering',
    roleKey: 'analysis',
    companion: 'Foldfox',
    companionId: 'foldfox',
    color: '#c4b5fd',
    emoji: '🧩',
    spotId: 'spot-3',
    sprite: 'dev-2',
  },
  {
    id: 'oak',
    aliases: ['watch', 'monitoring'],
    name: 'Oak',
    role: 'Monitoring / Watch',
    roleKey: 'monitoring',
    companion: 'Voltbug',
    companionId: 'voltbug',
    color: '#86efac',
    emoji: '👀',
    spotId: 'spot-4',
    sprite: 'security-audit-1',
  },
  {
    id: 'rex',
    aliases: ['lab', 'review', 'archive'],
    name: 'Rex',
    role: 'Review / Archive',
    roleKey: 'review',
    companion: 'Archivowl',
    companionId: 'archivowl',
    color: '#fcd34d',
    emoji: '📚',
    spotId: 'spot-5',
    sprite: 'employee-1',
  },
]

const BY_ID = new Map<string, OperatorDef>()
for (const op of OPERATORS) {
  BY_ID.set(op.id, op)
  for (const alias of op.aliases) BY_ID.set(alias.toLowerCase(), op)
}

export function resolveOperator(idOrName: string | undefined | null): OperatorDef | undefined {
  if (!idOrName) return undefined
  const key = idOrName.trim().toLowerCase()
  const direct = BY_ID.get(key)
  if (direct) return direct
  return OPERATORS.find(op => op.name.toLowerCase() === key)
}

export const COORD_ID = 'new-bot'
export const PERMANENT_IDS = new Set(OPERATORS.map(op => op.id))

export function isPermanent(id: string): boolean {
  return PERMANENT_IDS.has(id)
}

export function operatorFromAgent(agent: Pick<Agent, 'id' | 'role' | 'name'>): OperatorDef | undefined {
  return resolveOperator(agent.id) ?? resolveOperator(agent.role) ?? resolveOperator(agent.name)
}

export const DEFAULT_DUTY: Record<string, DutyStatus> = {
  'new-bot': 'working',
  mira: 'working',
  kai: 'idle',
  oak: 'idle',
  rex: 'idle',
}
