import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type {
  Ack,
  BoardSnapshot,
  Card,
  Column,
  ClientToServerEvents,
  Participant,
  ServerToClientEvents,
  UpdateCardInput,
} from '@canlipano/shared'
import { moveLocally, removeCard, upsertCard, upsertColumn, type BoardState } from './boardState'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>
export type ConnectionStatus = 'connecting' | 'online' | 'offline' | 'not-found'

/**
 * Connects to a board and keeps its state in sync.
 *
 * - Local changes are applied immediately (optimistic) and rolled back if the server rejects them.
 * - Changes from other people arrive as events and are merged into the state.
 * - After a reconnect the board is joined again and the full snapshot replaces local state,
 *   so events missed while offline can't leave the board out of date.
 */
export function useBoard(boardId: string, me: Participant | null) {
  const [state, setState] = useState<BoardState | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<AppSocket | null>(null)

  useEffect(() => {
    if (!me) return
    const socket: AppSocket = io({ transports: ['websocket'] })
    socketRef.current = socket

    const join = () =>
      socket.emit('board:join', { boardId, participant: me }, (res: Ack<BoardSnapshot>) => {
        if (!res.ok) {
          setStatus('not-found')
          return
        }
        const { board, columns, cards, participants } = res.data
        setState({ name: board.name, columns, cards, participants })
        setStatus('online')
      })

    socket.on('connect', join)
    socket.on('disconnect', () => setStatus('offline'))
    socket.on('card:upserted', (card) => setState((s) => s && upsertCard(s, card)))
    socket.on('card:deleted', ({ id }) => setState((s) => s && removeCard(s, id)))
    socket.on('column:upserted', (column) => setState((s) => s && upsertColumn(s, column)))
    socket.on('presence:update', (participants) => setState((s) => s && { ...s, participants }))

    return () => {
      socket.disconnect()
    }
  }, [boardId, me])

  /**
   * Sends an event. `optimistic` changes the local state right away; if the server says no,
   * the previous state is restored and the error is shown.
   */
  const send = useCallback(
    <T,>(event: keyof ClientToServerEvents, payload: unknown, optimistic?: (s: BoardState) => BoardState) =>
      new Promise<T | null>((resolve) => {
        let previous: BoardState | null = null
        if (optimistic) {
          setState((s) => {
            previous = s
            return s && optimistic(s)
          })
        }
        const emit = socketRef.current?.emit as unknown as (e: string, p: unknown, ack: (res: Ack<T>) => void) => void
        emit.call(socketRef.current, event, payload, (res) => {
          if (res.ok) return resolve(res.data)
          if (previous) setState(previous)
          setError(res.error)
          resolve(null)
        })
      }),
    []
  )

  const actions = {
    createCard: async (columnId: string, title: string) => {
      const card = await send<Card>('card:create', { columnId, title })
      if (card) setState((s) => s && upsertCard(s, card))
    },
    updateCard: async (input: UpdateCardInput) => {
      const card = await send<Card>('card:update', input, (s) => {
        const existing = s.cards.find((c) => c.id === input.id)
        return existing ? upsertCard(s, { ...existing, ...input }) : s
      })
      if (card) setState((s) => s && upsertCard(s, card))
    },
    moveCard: async (id: string, columnId: string, beforeId: string | null) => {
      const card = await send<Card>('card:move', { id, columnId, beforeId }, (s) =>
        moveLocally(s, id, columnId, beforeId)
      )
      if (card) setState((s) => s && upsertCard(s, card))
    },
    deleteCard: (id: string) => send('card:delete', { id }, (s) => removeCard(s, id)),
    createColumn: async (title: string) => {
      const column = await send<Column>('column:create', { title })
      if (column) setState((s) => s && upsertColumn(s, column))
    },
    renameColumn: (id: string, title: string) =>
      send('column:rename', { id, title }, (s) => {
        const column = s.columns.find((c) => c.id === id)
        return column ? upsertColumn(s, { ...column, title }) : s
      }),
  }

  return { state, status, error, clearError: () => setError(null), actions }
}
