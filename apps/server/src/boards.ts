import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { keyBetween, type BoardSnapshot, type CreateCardInput, type MoveCardInput, type UpdateCardInput } from '@canlipano/shared'
import { prisma } from './db'
import { UserError } from './errors'
import { toCard, toColumn } from './serialize'

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done']
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Short, unguessable id used in the board's link (~59 bits of randomness). */
function boardId(): string {
  return Array.from(randomBytes(10), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export async function createBoard(name: string) {
  let position: string | null = null
  const columns = DEFAULT_COLUMNS.map((title) => ({ title, position: (position = keyBetween(position, null)) }))

  const board = await prisma.board.create({
    data: { id: boardId(), name, columns: { create: columns } },
  })
  return { id: board.id, name: board.name, createdAt: board.createdAt.toISOString() }
}

export async function getSnapshot(id: string): Promise<Omit<BoardSnapshot, 'participants'> | null> {
  const board = await prisma.board.findUnique({
    where: { id },
    // id as a tie-breaker, the same rule as compareByPosition on the client
    include: {
      columns: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      cards: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!board) return null

  return {
    board: { id: board.id, name: board.name, createdAt: board.createdAt.toISOString() },
    columns: board.columns.map(toColumn),
    cards: board.cards.map(toCard),
  }
}

/**
 * Locks the column row for the rest of the transaction. Two people dropping cards into the
 * same column at the same moment are handled one after the other, so they never compute
 * the same position key from the same neighbours.
 */
async function lockColumn(tx: Prisma.TransactionClient, boardId: string, columnId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Column" WHERE id = ${columnId} AND "boardId" = ${boardId} FOR UPDATE`
  if (rows.length === 0) throw new UserError('Column not found')
}

export async function createCard(boardId: string, input: CreateCardInput, userName: string) {
  return prisma.$transaction(async (tx) => {
    await lockColumn(tx, boardId, input.columnId)
    const last = await tx.card.findFirst({
      where: { columnId: input.columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const card = await tx.card.create({
      data: {
        boardId,
        columnId: input.columnId,
        title: input.title,
        position: keyBetween(last?.position ?? null, null),
        updatedBy: userName,
      },
    })
    return toCard(card)
  })
}

export async function updateCard(boardId: string, input: UpdateCardInput, userName: string) {
  const { id, ...changes } = input
  const result = await prisma.card.updateMany({ where: { id, boardId }, data: { ...changes, updatedBy: userName } })
  if (result.count === 0) throw new UserError('Card not found')
  return toCard(await prisma.card.findUniqueOrThrow({ where: { id } }))
}

export async function moveCard(boardId: string, input: MoveCardInput, userName: string) {
  return prisma.$transaction(async (tx) => {
    await lockColumn(tx, boardId, input.columnId)

    const card = await tx.card.findFirst({ where: { id: input.id, boardId } })
    if (!card) throw new UserError('Card not found')

    // Neighbours in the target column, without the card being moved
    let before: string | null = null
    let after: string | null = null

    if (input.beforeId) {
      const next = await tx.card.findFirst({ where: { id: input.beforeId, columnId: input.columnId } })
      if (!next) throw new UserError('Target position no longer exists')
      after = next.position
      const prev = await tx.card.findFirst({
        where: { columnId: input.columnId, position: { lt: next.position }, id: { not: input.id } },
        orderBy: { position: 'desc' },
      })
      before = prev?.position ?? null
    } else {
      const last = await tx.card.findFirst({
        where: { columnId: input.columnId, id: { not: input.id } },
        orderBy: { position: 'desc' },
      })
      before = last?.position ?? null
    }

    const moved = await tx.card.update({
      where: { id: card.id },
      data: { columnId: input.columnId, position: keyBetween(before, after), updatedBy: userName },
    })
    return toCard(moved)
  })
}

export async function deleteCard(boardId: string, id: string) {
  const result = await prisma.card.deleteMany({ where: { id, boardId } })
  if (result.count === 0) throw new UserError('Card not found')
  return { id }
}

export async function createColumn(boardId: string, title: string) {
  return prisma.$transaction(async (tx) => {
    // Same idea as lockColumn: two people adding a column at the same moment must not read the
    // same "last" column. The board row is locked with FOR NO KEY UPDATE, which does not block
    // the foreign key checks of cards being created in the meantime.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Board" WHERE id = ${boardId} FOR NO KEY UPDATE`
    if (rows.length === 0) throw new UserError('Board not found')

    const last = await tx.column.findFirst({ where: { boardId }, orderBy: { position: 'desc' } })
    const column = await tx.column.create({
      data: { boardId, title, position: keyBetween(last?.position ?? null, null) },
    })
    return toColumn(column)
  })
}

export async function renameColumn(boardId: string, id: string, title: string) {
  const result = await prisma.column.updateMany({ where: { id, boardId }, data: { title } })
  if (result.count === 0) throw new UserError('Column not found')
  return toColumn(await prisma.column.findUniqueOrThrow({ where: { id } }))
}
