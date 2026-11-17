import { compareByPosition, keyBetween, type Card, type Column, type Participant } from '@canlipano/shared'

export interface BoardState {
  name: string
  columns: Column[]
  cards: Card[]
  participants: Participant[]
}

/** Pure state updates, shared by server events and optimistic local changes. */
export function upsertCard(state: BoardState, card: Card): BoardState {
  const exists = state.cards.some((c) => c.id === card.id)
  return { ...state, cards: exists ? state.cards.map((c) => (c.id === card.id ? card : c)) : [...state.cards, card] }
}

export function removeCard(state: BoardState, id: string): BoardState {
  return { ...state, cards: state.cards.filter((c) => c.id !== id) }
}

export function upsertColumn(state: BoardState, column: Column): BoardState {
  const exists = state.columns.some((c) => c.id === column.id)
  return {
    ...state,
    columns: exists ? state.columns.map((c) => (c.id === column.id ? column : c)) : [...state.columns, column],
  }
}

export function cardsIn(state: BoardState, columnId: string): Card[] {
  return state.cards.filter((c) => c.columnId === columnId).sort(compareByPosition)
}

/**
 * Applies a move locally right away (optimistic update), using the same position
 * logic as the server. The server's answer replaces it a moment later.
 */
export function moveLocally(state: BoardState, cardId: string, columnId: string, beforeId: string | null): BoardState {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card) return state

  const target = cardsIn(state, columnId).filter((c) => c.id !== cardId)
  const found = beforeId ? target.findIndex((c) => c.id === beforeId) : -1
  const index = found === -1 ? target.length : found
  const position = keyBetween(target[index - 1]?.position ?? null, target[index]?.position ?? null)

  return upsertCard(state, { ...card, columnId, position })
}
