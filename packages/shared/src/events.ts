import { z } from 'zod'
import { CARD_COLORS } from './types'
import type { Ack, BoardSnapshot, Card, Column, Participant } from './types'

/**
 * The Socket.IO protocol, shared by client and server.
 * The same Zod schemas validate input on the server and type the client calls,
 * so the two sides can't drift apart.
 */
export const schemas = {
  join: z.object({
    boardId: z.string().min(1).max(40),
    participant: z.object({
      id: z.string().min(1).max(40),
      name: z.string().trim().min(1).max(30),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
    }),
  }),
  createCard: z.object({
    columnId: z.string().min(1),
    title: z.string().trim().min(1, 'Title is required').max(200),
  }),
  updateCard: z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().max(2000).optional(),
    color: z.enum(CARD_COLORS).optional(),
  }),
  moveCard: z.object({
    id: z.string().min(1),
    columnId: z.string().min(1),
    /** The card it should be placed before, or null for the end of the column */
    beforeId: z.string().min(1).nullable(),
  }),
  deleteCard: z.object({ id: z.string().min(1) }),
  createColumn: z.object({ title: z.string().trim().min(1).max(60) }),
  renameColumn: z.object({ id: z.string().min(1), title: z.string().trim().min(1).max(60) }),
}

export type JoinInput = z.infer<typeof schemas.join>
export type CreateCardInput = z.infer<typeof schemas.createCard>
export type UpdateCardInput = z.infer<typeof schemas.updateCard>
export type MoveCardInput = z.infer<typeof schemas.moveCard>

export interface ClientToServerEvents {
  'board:join': (input: JoinInput, ack: (res: Ack<BoardSnapshot>) => void) => void
  'card:create': (input: CreateCardInput, ack: (res: Ack<Card>) => void) => void
  'card:update': (input: UpdateCardInput, ack: (res: Ack<Card>) => void) => void
  'card:move': (input: MoveCardInput, ack: (res: Ack<Card>) => void) => void
  'card:delete': (input: { id: string }, ack: (res: Ack<{ id: string }>) => void) => void
  'column:create': (input: { title: string }, ack: (res: Ack<Column>) => void) => void
  'column:rename': (input: { id: string; title: string }, ack: (res: Ack<Column>) => void) => void
}

export interface ServerToClientEvents {
  'card:upserted': (card: Card) => void
  'card:deleted': (payload: { id: string }) => void
  'column:upserted': (column: Column) => void
  'presence:update': (participants: Participant[]) => void
}
