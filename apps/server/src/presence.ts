import type { Participant } from '@canlipano/shared'

/**
 * Who is looking at which board, kept in memory.
 * One person can have the board open in several tabs, so presence is tracked per socket
 * and de-duplicated by participant id when listed.
 * (With several server instances this would move to Redis.)
 */
export class Presence {
  private boards = new Map<string, Map<string, Participant>>()

  join(boardId: string, socketId: string, participant: Participant) {
    if (!this.boards.has(boardId)) this.boards.set(boardId, new Map())
    this.boards.get(boardId)!.set(socketId, participant)
  }

  leave(boardId: string, socketId: string) {
    const sockets = this.boards.get(boardId)
    sockets?.delete(socketId)
    if (sockets?.size === 0) this.boards.delete(boardId)
  }

  list(boardId: string): Participant[] {
    const unique = new Map<string, Participant>()
    for (const p of this.boards.get(boardId)?.values() ?? []) unique.set(p.id, p)
    return [...unique.values()]
  }
}
