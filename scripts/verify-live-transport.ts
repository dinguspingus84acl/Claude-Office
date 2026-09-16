import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  LOCAL_ROSTER_URL,
  LOCAL_WS_URL,
  isLoopbackHost,
  isLoopbackWsUrl,
  isPagesHost,
  resolveLocalRosterUrl,
  resolveLocalWsUrl,
  shouldOpenAgentSocket,
  shouldUseLocalAgentSocket,
} from '../src/liveTransport.ts'

describe('isPagesHost', () => {
  it('matches grokbottech.com and subdomains', () => {
    assert.equal(isPagesHost('grokbottech.com'), true)
    assert.equal(isPagesHost('www.grokbottech.com'), true)
    assert.equal(isPagesHost('GrokBotTech.com'), true)
  })

  it('matches GitHub Pages hosts', () => {
    assert.equal(isPagesHost('dinguspingus84acl.github.io'), true)
    assert.equal(isPagesHost('org.github.io'), true)
  })

  it('rejects loopback and empty hosts', () => {
    assert.equal(isPagesHost('localhost'), false)
    assert.equal(isPagesHost('127.0.0.1'), false)
    assert.equal(isPagesHost(''), false)
  })
})

describe('shouldUseLocalAgentSocket', () => {
  it('allows loopback only', () => {
    assert.equal(shouldUseLocalAgentSocket('localhost'), true)
    assert.equal(shouldUseLocalAgentSocket('127.0.0.1'), true)
    assert.equal(shouldUseLocalAgentSocket('::1'), true)
  })

  it('disables on Pages / production hostnames', () => {
    assert.equal(shouldUseLocalAgentSocket('grokbottech.com'), false)
    assert.equal(shouldUseLocalAgentSocket('www.grokbottech.com'), false)
    assert.equal(shouldUseLocalAgentSocket('dinguspingus84acl.github.io'), false)
  })

  it('disables on empty or unknown hosts', () => {
    assert.equal(shouldUseLocalAgentSocket(''), false)
    assert.equal(shouldUseLocalAgentSocket('example.com'), false)
  })
})

describe('resolveLocalWsUrl / roster', () => {
  it('returns localhost URLs only on loopback', () => {
    assert.equal(resolveLocalWsUrl('localhost'), LOCAL_WS_URL)
    assert.equal(resolveLocalRosterUrl('localhost'), LOCAL_ROSTER_URL)
  })

  it('returns null on grokbottech.com and github.io', () => {
    assert.equal(resolveLocalWsUrl('grokbottech.com'), null)
    assert.equal(resolveLocalRosterUrl('grokbottech.com'), null)
    assert.equal(resolveLocalWsUrl('dinguspingus84acl.github.io'), null)
    assert.equal(resolveLocalRosterUrl('dinguspingus84acl.github.io'), null)
  })
})

describe('shouldOpenAgentSocket', () => {
  it('never opens when disabled, even with a localhost URL', () => {
    assert.equal(shouldOpenAgentSocket({
      disabled: true,
      url: LOCAL_WS_URL,
      hostname: 'localhost',
    }), false)
  })

  it('never opens localhost WS on grokbottech.com', () => {
    assert.equal(shouldOpenAgentSocket({
      url: LOCAL_WS_URL,
      hostname: 'grokbottech.com',
    }), false)
  })

  it('never opens when URL is unset on a Pages host', () => {
    assert.equal(shouldOpenAgentSocket({
      url: null,
      hostname: 'grokbottech.com',
    }), false)
  })

  it('opens on localhost with a loopback ws URL', () => {
    assert.equal(shouldOpenAgentSocket({
      url: LOCAL_WS_URL,
      hostname: 'localhost',
    }), true)
  })

  it('rejects non-loopback WS targets even on localhost', () => {
    assert.equal(isLoopbackWsUrl('ws://example.com/ws'), false)
    assert.equal(shouldOpenAgentSocket({
      url: 'ws://example.com/ws',
      hostname: 'localhost',
    }), false)
  })

  it('isLoopbackHost covers ipv6 loopback', () => {
    assert.equal(isLoopbackHost('[::1]'), true)
  })
})
