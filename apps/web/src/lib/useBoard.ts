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
import { changedFields, track } from './analytics'
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
  // True from the moment the board is joined until the connection drops
  const onlineRef = useRef(false)

  useEffect(() => {
    if (!me) return
    const socket: AppSocket = io({ transports: ['websocket'] })
    socketRef.current = socket
    let retry: ReturnType<typeof setTimeout> | undefined

    const join = () =>
      socket.emit('board:join', { boardId, participant: me }, (res: Ack<BoardSnapshot>) => {
        if (!res.ok) {
          onlineRef.current = false
          if (res.error === 'Board not found') setStatus('not-found')
          else retry = setTimeout(join, 2000) // a temporary problem on the server: try again
          return
        }
        onlineRef.current = true
        const { board, columns, cards, participants } = res.data
        setState({ name: board.name, columns, cards, participants })
        setStatus('online')
      })

    let offlineSince: number | null = null
    socket.on('connect', () => {
      if (offlineSince !== null) {
        track('reconnected', { offline_seconds: Math.round((Date.now() - offlineSince) / 1000) })
        offlineSince = null
      }
      join()
    })
    socket.on('disconnect', () => {
      onlineRef.current = false
      offlineSince = Date.now()
      setStatus('offline')
    })
    socket.on('card:upserted', (card) => setState((s) => s && upsertCard(s, card)))
    socket.on('card:deleted', ({ id }) => setState((s) => s && removeCard(s, id)))
    socket.on('column:upserted', (column) => setState((s) => s && upsertColumn(s, column)))
    socket.on('presence:update', (participants) => setState((s) => s && { ...s, participants }))

    return () => {
      clearTimeout(retry)
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
        // Events sent while offline would be held back and then refused after the reconnect,
        // because the new connection has not joined the board yet
        if (!onlineRef.current) {
          setError('You are offline. Changes are not saved until the connection is back.')
          resolve(null)
          return
        }
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
          track('action_rejected', { action: String(event) })
          setError(res.error)
          resolve(null)
        })
      }),
    []
  )

  const actions = {
    createCard: async (columnId: string, title: string) => {
      const card = await send<Card>('card:create', { columnId, title })
      if (!card) return
      track('card_created')
      setState((s) => s && upsertCard(s, card))
    },
    updateCard: async (input: UpdateCardInput) => {
      const card = await send<Card>('card:update', input, (s) => {
        const existing = s.cards.find((c) => c.id === input.id)
        return existing ? upsertCard(s, { ...existing, ...input }) : s
      })
      if (!card) return
      track('card_edited', { fields: changedFields({ ...input }) })
      setState((s) => s && upsertCard(s, card))
    },
    moveCard: async (id: string, columnId: string, beforeId: string | null) => {
      const card = await send<Card>('card:move', { id, columnId, beforeId }, (s) =>
        moveLocally(s, id, columnId, beforeId)
      )
      if (card) setState((s) => s && upsertCard(s, card))
    },
    deleteCard: async (id: string) => {
      const res = await send('card:delete', { id }, (s) => removeCard(s, id))
      if (res !== null) track('card_deleted')
      return res
    },
    createColumn: async (title: string) => {
      const column = await send<Column>('column:create', { title })
      if (!column) return
      track('column_created')
      setState((s) => s && upsertColumn(s, column))
    },
    renameColumn: (id: string, title: string) =>
      send('column:rename', { id, title }, (s) => {
        const column = s.columns.find((c) => c.id === id)
        return column ? upsertColumn(s, { ...column, title }) : s
      }),
  }

  return { state, status, error, clearError: () => setError(null), actions }
}
