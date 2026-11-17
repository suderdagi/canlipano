export interface Board {
  id: string
  name: string
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  title: string
  position: string
}

export const CARD_COLORS = ['gray', 'red', 'amber', 'green', 'blue', 'violet'] as const
export type CardColor = (typeof CARD_COLORS)[number]

export interface Card {
  id: string
  boardId: string
  columnId: string
  title: string
  description: string
  color: CardColor
  position: string
  updatedAt: string
  updatedBy: string | null
}

export interface Participant {
  id: string
  name: string
  color: string
}

export interface BoardSnapshot {
  board: Board
  columns: Column[]
  cards: Card[]
  participants: Participant[]
}

/** Every acknowledgement has this shape, so the client can handle errors in one place. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: string }
