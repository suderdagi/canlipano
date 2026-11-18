import type { UpdateCardInput } from '@canlipano/shared'

export interface CardFields {
  title: string
  description: string
}

/**
 * The fields a person changed while the card dialog was open. They are compared with what the
 * dialog held when it was opened, not with the live card: someone else may have edited the card
 * in the meantime, and sending the old text back would silently overwrite their edit.
 * Returns null when nothing changed.
 */
export function cardChanges(id: string, opened: CardFields, edited: CardFields): UpdateCardInput | null {
  const changes: UpdateCardInput = { id }
  const title = edited.title.trim()
  if (title && title !== opened.title) changes.title = title
  if (edited.description !== opened.description) changes.description = edited.description
  return Object.keys(changes).length > 1 ? changes : null
}
