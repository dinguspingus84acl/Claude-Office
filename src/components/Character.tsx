import React, { useRef, useState, useEffect } from 'react'
import { Agent, AgentState } from '../types'
import SpeechBubble from './SpeechBubble'
import EffectBubble from './EffectBubble'
import { getEffect } from '../agentManager'
import { ROLE_TO_CHAR } from '../config'
import { getSpritePath, useTheme } from '../theme'
import { dutyEffect } from '../statusAdapter'

export { ROLE_TO_CHAR }

interface CharacterProps {
  agent: Agent
  idleDurationMs?: number
  zIndex?: number
  isTyping?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
}

type SpriteDirection = 'front-left' | 'front-right' | 'rear-left' | 'rear-right'

function getDirectionFromDelta(dx: number, dy: number): SpriteDirection {
  if (dy < 0 && dx >= 0)  return 'front-left'
  if (dy < 0 && dx < 0)   return 'front-right'
  if (dy >= 0 && dx >= 0)  return 'rear-left'
  return 'front-left'
}

function getCharBase(role: string): string {
  return ROLE_TO_CHAR[role] ?? 'employee-3'
}

function getAnimState(state: AgentState): string {
  switch (state) {
    case 'working':             return 'working'
    case 'walking-to-manager':
    case 'walking-to-desk':     return 'walking'
    case 'talking-to-manager':  return 'talking'
    case 'coffee-break':        return 'coffee'
    case 'new-hire':            return 'new-hire'
    default:                    return 'idle'
  }
}

function shouldShowBubble(state: AgentState): boolean {
  return state === 'talking-to-manager'
}

const OPPOSITE: Record<SpriteDirection, SpriteDirection> = {
  'front-left': 'rear-right',
  'front-right': 'rear-left',
  'rear-left': 'front-right',
  'rear-right': 'front-left',
}

const Character: React.FC<CharacterProps> = ({
  agent, idleDurationMs = 0, zIndex, isTyping, selected, onSelect,
}) => {
  const prevPosRef = useRef({ x: agent.position.x, y: agent.position.y })
  const directionRef = useRef<SpriteDirection>(agent.spriteFacing ?? 'front-right')
  const [turnedAround, setTurnedAround] = useState(false)

  const isMoving = agent.state === 'new-hire' || agent.state === 'walking-to-desk' ||
    agent.state === 'coffee-break' || agent.state === 'completed' || agent.state === 'changing-room'

  const dx = agent.position.x - prevPosRef.current.x
  const dy = agent.position.y - prevPosRef.current.y

  if (isMoving && (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005)) {
    directionRef.current = getDirectionFromDelta(dx, dy)
  } else if (!isMoving && agent.spriteFacing) {
    directionRef.current = turnedAround ? OPPOSITE[agent.spriteFacing] : agent.spriteFacing
  }
  prevPosRef.current = { x: agent.position.x, y: agent.position.y }

  useEffect(() => {
    if (agent.state !== 'working') {
      setTurnedAround(false)
      return
    }
    const cancelledRef = { current: false }
    let timeout: ReturnType<typeof setTimeout>
    const scheduleTurn = () => {
      if (cancelledRef.current) return
      const waitTime = 3000 + Math.random() * 12000
      timeout = setTimeout(() => {
        if (cancelledRef.current) return
        setTurnedAround(prev => !prev)
        const stayTime = 1000 + Math.random() * 5000
        timeout = setTimeout(() => {
          if (cancelledRef.current) return
          setTurnedAround(prev => !prev)
          scheduleTurn()
        }, stayTime)
      }, waitTime)
    }
    scheduleTurn()
    return () => {
      cancelledRef.current = true
      clearTimeout(timeout)
    }
  }, [agent.state])

  if (agent.present === false) return null

  const animState = getAnimState(agent.state)
  const charBase = getCharBase(agent.role) || getCharBase(agent.id)
  const theme = useTheme()
  const spriteSrc = getSpritePath(agent.id, agent.role, charBase, directionRef.current)
  void theme

  const duty = agent.dutyStatus
  const cueOnce = duty === 'done' && agent.cueKey === `done:${agent.updatedAt ?? ''}`
  const dutyFx = duty ? dutyEffect(duty, cueOnce || duty !== 'done') : null
  const effectSrc = isTyping
    ? '/sprites/effects/typing.png'
    : dutyFx ?? getEffect(agent.state, idleDurationMs, agent.statusText, agent.id, agent.task, agent.role)

  const dutyClass = duty === 'needs_approval' ? ' duty-approval'
    : duty === 'blocked' || duty === 'failed' ? ' duty-blocked'
    : ''

  const atDesk = Math.abs(agent.position.x - agent.deskPosition.x) < 1.2
    && Math.abs(agent.position.y - agent.deskPosition.y) < 1.2

  return (
    <div
      className={`character-wrapper state-${animState}${dutyClass}${selected ? ' selected' : ''}`}
      style={{
        left: `${agent.position.x}%`,
        top: `${agent.position.y}%`,
        transform: 'translate(-50%, -100%)',
        zIndex: zIndex ?? Math.round(agent.position.y),
        cursor: 'pointer',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(agent.id)
      }}
    >
      {effectSrc && <EffectBubble src={effectSrc} alt={agent.state} />}

      {shouldShowBubble(agent.state) && agent.statusText && (
        <SpeechBubble key={agent.statusText} text={agent.statusText} />
      )}

      <div className="char-body-group">
        <div className="char-shadow" />
        <img
          src={spriteSrc}
          alt={agent.name}
          className="char-sprite"
          style={{
            height: agent.id === 'new-bot' ? 85 : 78,
            width: 'auto',
            filter: `drop-shadow(0 0 1px ${agent.color}) drop-shadow(0 0 0.5px #000)`,
            animationDelay: `${(agent.id.charCodeAt(0) * 0.37) % 3}s`,
          }}
          draggable={false}
        />
        {atDesk && agent.companionId && (
          <img
            src={`/sprites/companions/${agent.companionId}.png`}
            alt={agent.companion ?? 'companion'}
            className="companion-sprite"
            draggable={false}
          />
        )}
      </div>
    </div>
  )
}

export default Character
