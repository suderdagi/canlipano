import { afterEach, describe, expect, it } from 'vitest'
import { changedFields, isFirstCollaboration, setAnalyticsSink, track, trackPageview } from './analytics'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

function recordingSink() {
  const events: { name: string; props?: Record<string, unknown> }[] = []
  setAnalyticsSink({ capture: (name, props) => events.push({ name, props }), identify() {} })
  return events
}

afterEach(() => setAnalyticsSink(null))

describe('analytics', () => {
  it('is a no-op without a sink', () => {
    expect(() => track('card_created')).not.toThrow()
  })

  it('sends events with their properties', () => {
    const events = recordingSink()
    track('card_moved', { across_columns: true })
    expect(events).toEqual([{ name: 'card_moved', props: { across_columns: true } }])
  })

  it('never sends a board id in pageviews', () => {
    const events = recordingSink()
    trackPageview('/b/3f1c2a9e-secret-board')
    trackPageview('/')
    expect(events.map((e) => e.props?.$pathname)).toEqual(['/b/:boardId', '/'])
  })

  it('lists changed field names without their values', () => {
    expect(changedFields({ id: 'c1', title: 'New title', color: 'red', description: undefined })).toEqual(['color', 'title'])
  })
})

describe('isFirstCollaboration', () => {
  it('is false while only one person is on the board', () => {
    expect(isFirstCollaboration('b1', 1, memoryStorage())).toBe(false)
  })

  it('is true once per board, the first time two people are on it', () => {
    const storage = memoryStorage()
    expect(isFirstCollaboration('b1', 2, storage)).toBe(true)
    expect(isFirstCollaboration('b1', 3, storage)).toBe(false)
    expect(isFirstCollaboration('b2', 2, storage)).toBe(true)
  })

  it('recovers from a corrupted stored value', () => {
    const storage = memoryStorage()
    storage.setItem('canlipano.collaborative', '{not json')
    expect(isFirstCollaboration('b1', 2, storage)).toBe(true)
  })
})
