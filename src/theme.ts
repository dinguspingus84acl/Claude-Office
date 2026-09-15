/**
 * theme.ts — sprite path helpers.
 *
 * Dunder Mifflin / Office TV theme pack was removed. Donor directional
 * sprites in /sprites/characters remain the only walking characters.
 */

import { useSyncExternalStore } from 'react'
import { OPERATORS } from './operators'

export type ThemeName = 'default'

export function getTheme(): ThemeName { return 'default' }
export function setTheme(_name: string) { /* theme packs removed */ }
export function toggleTheme() { /* no-op — TV theme removed */ }
export function subscribeTheme(fn: () => void): () => void {
  return () => { void fn }
}
export function useTheme(): ThemeName {
  return useSyncExternalStore(() => () => {}, () => 'default', () => 'default')
}

export function getCharacterBaseForRole(role: string, defaultBase: string): string {
  const op = OPERATORS.find(o => o.roleKey === role || o.role === role || o.id === role)
  return op?.sprite ?? defaultBase
}

export function getSpriteDir(): string {
  return '/sprites/characters'
}

export function getSpritePath(_agentId: string, role: string, defaultBase: string, direction: string): string {
  const base = getCharacterBaseForRole(role, defaultBase)
  return `${getSpriteDir()}/${base}-${direction}.png`
}

export function getRoomImage(phase: 'day' | 'night'): string {
  return phase === 'night' ? '/rooms/office-night.png' : '/rooms/office-day.png'
}

export function getAngelaCat(): { role: string; catSprite: string } | null {
  return null
}

export function themedDisplayName(_role: string, fallback: string): string {
  return fallback
}

const SPAWN = ['clocked in', 'reporting for duty', 'on the floor']
const WORK = ['on it', 'in the zone', 'making progress']
const DONE = ['done', 'parked', 'logged']
const COFFEE = ['short break', 'stepping away']
const WATER = ['hydration check']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export function themedSpawn(): string { return pick(SPAWN) }
export function themedWork(): string { return pick(WORK) }
export function themedDone(): string { return pick(DONE) }
export function themedCoffee(): string { return pick(COFFEE) }
export function themedWater(): string { return pick(WATER) }

export const OFFICE_SIM_TOOL_MESSAGES: Record<string, string[]> = {}
export const OFFICE_SIM_BOSS_PROMPTS: string[] = []

export function getAllOfficeCharacters(): readonly string[] { return [] }
export function assignCharacterToRole(_role: string, _slug: string) { /* removed */ }
export function releaseRole(_role: string) { /* removed */ }
export function getActiveCastSlugs(): Set<string> { return new Set() }
export function nextUnusedOfficeCharacter(): string { return 'employee-3' }
export function displayNameFromSlug(slug: string): string {
  return slug.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join(' ')
}
export function getOfficePropForRole(_role: string): string | null { return null }
