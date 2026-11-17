import { describe, expect, it } from 'vitest'
import { compareByPosition, keyBetween } from './ordering'

describe('keyBetween', () => {
  it('creates keys that sort between their neighbours', () => {
    const first = keyBetween(null, null)
    const after = keyBetween(first, null)
    const before = keyBetween(null, first)
    const middle = keyBetween(first, after)

    expect([after, middle, first, before].sort()).toEqual([before, first, middle, after])
  })

  it('can always insert between two adjacent keys', () => {
    let low = keyBetween(null, null)
    const high = keyBetween(low, null)
    // Inserting right after `low` 50 times keeps producing valid, ordered keys
    for (let i = 0; i < 50; i++) {
      const next = keyBetween(low, high)
      expect(next > low && next < high).toBe(true)
      low = next
    }
  })

  it('keeps keys short when appending many cards to the end', () => {
    let last: string | null = null
    for (let i = 0; i < 200; i++) last = keyBetween(last, null)
    expect(last!.length).toBeLessThan(10)
  })

  it('rejects an invalid range', () => {
    expect(() => keyBetween('b', 'a')).toThrow()
  })

  it('matches a simulated drag and drop order', () => {
    // Start with 5 cards, then move random cards to random places many times
    let cards = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, position: '' }))
    let prev: string | null = null
    for (const c of cards) prev = c.position = keyBetween(prev, null)

    let expected = cards.map((c) => c.id)
    let seed = 7
    const rand = (n: number) => (seed = (seed * 9301 + 49297) % 233280) % n

    for (let step = 0; step < 300; step++) {
      const sorted = [...cards].sort(compareByPosition)
      const moving = sorted[rand(sorted.length)]
      const rest = sorted.filter((c) => c.id !== moving.id)
      const index = rand(rest.length + 1)
      moving.position = keyBetween(rest[index - 1]?.position ?? null, rest[index]?.position ?? null)

      expected = expected.filter((id) => id !== moving.id)
      expected.splice(index, 0, moving.id)
      cards = [...rest, moving]
      expect([...cards].sort(compareByPosition).map((c) => c.id)).toEqual(expected)
    }
  })
})
