import type { Server, Socket } from 'socket.io'
import type { ZodType } from 'zod'
import { schemas, type Ack, type ClientToServerEvents, type Participant, type ServerToClientEvents } from '@canlipano/shared'
import * as boards from './boards'
import { UserError } from './errors'
import { logger } from './logger'
import { Presence } from './presence'
import { createRateLimiter } from './rateLimit'

export interface SocketData {
  boardId?: string
  participant?: Participant
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

const room = (boardId: string) => `board:${boardId}`

export function registerSocketHandlers(io: IO) {
  const presence = new Presence()

  io.on('connection', (socket: AppSocket) => {
    const allow = createRateLimiter()

    /**
     * Wraps every event handler: rate limit, check that the socket joined a board,
     * validate the payload and turn the result or error into an acknowledgement.
     */
    function on<T, R>(
      event: keyof ClientToServerEvents,
      schema: ZodType<T>,
      handler: (input: T, ctx: { boardId: string; participant: Participant }) => Promise<R>
    ) {
      // The generic wrapper can't express per-event types, the event map above stays the source of truth
      const listen = socket.on.bind(socket) as unknown as (e: string, fn: (raw: unknown, ack?: (res: Ack<R>) => void) => void) => void
      listen(event, async (raw, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {}

        if (!allow()) return reply({ ok: false, error: 'Too many changes, slow down' })
        const { boardId, participant } = socket.data
        if (!boardId || !participant) return reply({ ok: false, error: 'Join a board first' })

        const parsed = schema.safeParse(raw)
        if (!parsed.success) return reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' })

        try {
          reply({ ok: true, data: await handler(parsed.data, { boardId, participant }) })
        } catch (error) {
          if (error instanceof UserError) return reply({ ok: false, error: error.message })
          logger.error({ err: error, event }, 'socket handler failed')
          reply({ ok: false, error: 'Something went wrong' })
        }
      })
    }

    socket.on('board:join', async (raw, ack) => {
      // A client can omit the acknowledgement callback; calling it would throw inside an async
      // handler, and an unhandled rejection stops the whole server. Same guard as in on().
      const reply = typeof ack === 'function' ? ack : () => {}

      if (!allow()) return reply({ ok: false, error: 'Too many changes, slow down' })

      const parsed = schemas.join.safeParse(raw)
      if (!parsed.success) return reply({ ok: false, error: 'Invalid join request' })
      const { boardId, participant } = parsed.data

      try {
        const snapshot = await boards.getSnapshot(boardId)
        if (!snapshot) return reply({ ok: false, error: 'Board not found' })

        // A socket can only be in one board at a time
        const previous = socket.data.boardId
        if (previous) {
          socket.leave(room(previous))
          presence.leave(previous, socket.id)
          if (previous !== boardId) io.to(room(previous)).emit('presence:update', presence.list(previous))
        }

        socket.data = { boardId, participant }
        socket.join(room(boardId))
        presence.join(boardId, socket.id, participant)

        reply({ ok: true, data: { ...snapshot, participants: presence.list(boardId) } })
        socket.to(room(boardId)).emit('presence:update', presence.list(boardId))
      } catch (error) {
        logger.error({ err: error, event: 'board:join' }, 'socket handler failed')
        reply({ ok: false, error: 'Something went wrong' })
      }
    })

    // Every change is sent back to the sender in the ack, and broadcast to everyone else in the room
    on('card:create', schemas.createCard, async (input, { boardId, participant }) => {
      const card = await boards.createCard(boardId, input, participant.name)
      socket.to(room(boardId)).emit('card:upserted', card)
      return card
    })

    on('card:update', schemas.updateCard, async (input, { boardId, participant }) => {
      const card = await boards.updateCard(boardId, input, participant.name)
      socket.to(room(boardId)).emit('card:upserted', card)
      return card
    })

    on('card:move', schemas.moveCard, async (input, { boardId, participant }) => {
      const card = await boards.moveCard(boardId, input, participant.name)
      socket.to(room(boardId)).emit('card:upserted', card)
      return card
    })

    on('card:delete', schemas.deleteCard, async ({ id }, { boardId }) => {
      const result = await boards.deleteCard(boardId, id)
      socket.to(room(boardId)).emit('card:deleted', result)
      return result
    })

    on('column:create', schemas.createColumn, async ({ title }, { boardId }) => {
      const column = await boards.createColumn(boardId, title)
      socket.to(room(boardId)).emit('column:upserted', column)
      return column
    })

    on('column:rename', schemas.renameColumn, async ({ id, title }, { boardId }) => {
      const column = await boards.renameColumn(boardId, id, title)
      socket.to(room(boardId)).emit('column:upserted', column)
      return column
    })

    socket.on('disconnect', () => {
      const { boardId } = socket.data
      if (!boardId) return
      presence.leave(boardId, socket.id)
      io.to(room(boardId)).emit('presence:update', presence.list(boardId))
    })
  })
}
