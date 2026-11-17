import type { Card as DbCard, Column as DbColumn } from '@prisma/client'
import type { Card, CardColor, Column } from '@canlipano/shared'

export const toCard = (c: DbCard): Card => ({
  id: c.id,
  boardId: c.boardId,
  columnId: c.columnId,
  title: c.title,
  description: c.description,
  color: c.color as CardColor,
  position: c.position,
  updatedAt: c.updatedAt.toISOString(),
  updatedBy: c.updatedBy,
})

export const toColumn = (c: DbColumn): Column => ({
  id: c.id,
  boardId: c.boardId,
  title: c.title,
  position: c.position,
})
