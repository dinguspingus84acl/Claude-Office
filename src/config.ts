/**
 * config.ts — New Bot HQ branding + donor sprite map for the five operators.
 */

import { OPERATORS, PRODUCT_NAME, PRODUCT_DOMAIN, PRODUCT_MODE, DEFAULT_STATUS_URLS } from './operators'
import exampleConfig from '../office.config.example.json'

const userConfig = exampleConfig as {
  product?: string
  domain?: string
  mode?: string
  statusUrl?: string
}

export const PRODUCT = userConfig.product ?? PRODUCT_NAME
export const DOMAIN = userConfig.domain ?? PRODUCT_DOMAIN
export const MODE_LABEL = userConfig.mode ?? PRODUCT_MODE
export const STATUS_URL = userConfig.statusUrl ?? DEFAULT_STATUS_URLS[0]

const coord = OPERATORS[0]

export const BOSS_CHAR = coord.sprite
export const BOSS_ROLE = coord.roleKey
export const BOSS_NAME = coord.name
export const BOSS_COLOR = coord.color
export const BOSS_EMOJI = coord.emoji

export const ROLE_TO_CHAR: Record<string, string> = {}
for (const op of OPERATORS) {
  ROLE_TO_CHAR[op.id] = op.sprite
  ROLE_TO_CHAR[op.roleKey] = op.sprite
  ROLE_TO_CHAR[op.role] = op.sprite
  ROLE_TO_CHAR[op.name] = op.sprite
}
