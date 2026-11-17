import { describe, expect, it } from 'vitest'
import { keyBetween, type Card } from '@canlipano/shared'
import { cardsIn, moveLocally, upsertCard, type BoardState } from './boardState'

function card(id: string, columnId: string, position: string): Card {
  return { id, boardId: 'b', columnId, title: id, description: '', color: 'gray', position, updatedAt: '', updatedBy: null }
}

const a = keyBetween(null, null)
const b = keyBetween(a, null)
const c = keyBetween(b, null)

const state: BoardState = {
  name: 'Test',
  columns: [],
  participants: [],
  cards: [card('A', 'todo', a), card('B', 'todo', b), card('C', 'todo', c)],
}

const titles = (s: BoardState, col: string) => cardsIn(s, col).map((x) => x.id)

describe('moveLocally', () => {
  it('moves a card before another card in the same column', () => {
    expect(titles(moveLocally(state, 'C', 'todo', 'A'), 'todo')).toEqual(['C', 'A', 'B'])
  })

  it('moves a card to the end of another column', () => {
    const next = moveLocally(state, 'A', 'done', null)
    expect(titles(next, 'todo')).toEqual(['B', 'C'])
    expect(titles(next, 'done')).toEqual(['A'])
  })

  it('falls back to the end when the target card disappeared', () => {
    expect(titles(moveLocally(state, 'A', 'todo', 'deleted-card'), 'todo')).toEqual(['B', 'C', 'A'])
  })
})

describe('upsertCard', () => {
  it('replaces an existing card instead of duplicating it', () => {
    const next = upsertCard(state, { ...state.cards[0], title: 'Renamed' })
    expect(next.cards).toHaveLength(3)
    expect(next.cards[0].title).toBe('Renamed')
  })
})
