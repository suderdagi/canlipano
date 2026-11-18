import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Check, Link2, Plus } from 'lucide-react'
import { compareByPosition, type Card, type Participant } from '@canlipano/shared'
import { loadIdentity, saveIdentity } from '../lib/identity'
import { rememberBoard } from '../lib/recentBoards'
import { identify, isFirstCollaboration, track } from '../lib/analytics'
import { cardsIn } from '../lib/boardState'
import { useBoard, type ConnectionStatus } from '../lib/useBoard'
import { ColumnView } from '../components/ColumnView'
import { CardView } from '../components/CardItem'
import { CardDialog } from '../components/CardDialog'

export function BoardPage() {
  const { boardId = '' } = useParams()
  const [me, setMe] = useState<Participant | null>(loadIdentity)

  if (!me) return <NamePrompt onDone={(name) => setMe(saveIdentity(name))} />
  return <Board boardId={boardId} me={me} />
}

function Board({ boardId, me }: { boardId: string; me: Participant }) {
  const { state, status, error, clearError, actions } = useBoard(boardId, me)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    // A small distance lets a click open the card instead of starting a drag
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // On touch screens a drag starts after a short press; moving right away scrolls the board
    // instead (a pointer sensor would hand every touch gesture over to the browser's scrolling)
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (state) {
      rememberBoard(boardId, state.name)
      document.title = `${state.name} · CanlıPano`
    }
  }, [boardId, state?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => identify(me.id), [me.id])

  // Sent once per visit, when the board has loaded
  const loaded = state !== null
  useEffect(() => {
    if (loaded) track('board_opened', { participants: state.participants.length })
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const participantCount = state?.participants.length ?? 0
  useEffect(() => {
    if (isFirstCollaboration(boardId, participantCount, localStorage)) {
      track('board_became_collaborative', { participants: participantCount })
    }
  }, [boardId, participantCount])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(clearError, 4000)
    return () => clearTimeout(timer)
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [...(state?.columns ?? [])].sort(compareByPosition),
    [state?.columns]
  )

  if (status === 'not-found') {
    return (
      <div className="grid min-h-screen place-items-center text-center">
        <div>
          <h1 className="text-xl font-semibold">Board not found</h1>
          <Link to="/" className="mt-3 inline-block text-teal-700 hover:underline">
            Create a new board
          </Link>
        </div>
      </div>
    )
  }

  if (!state) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Connecting…</div>
  }

  const activeCard = state.cards.find((c) => c.id === activeId) ?? null
  const openCard = state.cards.find((c) => c.id === openCardId) ?? null

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const card = state.cards.find((c) => c.id === active.id)
    if (!card || !over || active.id === over.id) return

    let columnId: string
    let beforeId: string | null

    if (over.data.current?.type === 'column') {
      // Dropped on the empty part of a column: put it at the end
      columnId = String(over.id)
      beforeId = null
    } else {
      const target = state.cards.find((c) => c.id === over.id)
      if (!target) return
      columnId = target.columnId
      const list = cardsIn(state, columnId)

      if (card.columnId === columnId) {
        const from = list.findIndex((c) => c.id === card.id)
        const to = list.findIndex((c) => c.id === target.id)
        const reordered = arrayMove(list, from, to)
        beforeId = reordered[to + 1]?.id ?? null
      } else {
        beforeId = target.id
      }
    }

    track('card_moved', { across_columns: card.columnId !== columnId })
    actions.moveCard(card.id, columnId, beforeId)
  }

  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href)
    track('board_link_copied')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label="Home">
            <img src="/logo.svg" alt="" className="h-8 w-8" />
          </Link>
          <h1 className="truncate text-lg font-semibold">{state.name}</h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-3">
          <Participants participants={state.participants} meId={me.id} />
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            {copied ? 'Copied' : 'Share link'}
          </button>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6">
          {columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              cards={cardsIn(state, column.id)}
              onAddCard={(title) => actions.createCard(column.id, title)}
              onRename={(title) => actions.renameColumn(column.id, title)}
              onOpenCard={(c: Card) => setOpenCardId(c.id)}
            />
          ))}
          <AddColumn onAdd={actions.createColumn} />
        </main>
        <DragOverlay>{activeCard && <CardView card={activeCard} dragging />}</DragOverlay>
      </DndContext>

      <CardDialog card={openCard} onClose={() => setOpenCardId(null)} onSave={actions.updateCard} onDelete={actions.deleteCard} />

      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const online = status === 'online'
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'animate-pulse bg-amber-500')} />
      {online ? 'Live' : 'Reconnecting…'}
    </span>
  )
}

function Participants({ participants, meId }: { participants: Participant[]; meId: string }) {
  return (
    <ul className="flex -space-x-2" aria-label={`${participants.length} people on this board`}>
      {participants.slice(0, 6).map((p) => (
        <li
          key={p.id}
          title={p.id === meId ? `${p.name} (you)` : p.name}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-white text-xs font-bold text-white"
          style={{ backgroundColor: p.color }}
        >
          {p.name.charAt(0).toLocaleUpperCase('tr')}
        </li>
      ))}
      {participants.length > 6 && (
        <li className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-400 text-xs font-bold text-white">
          +{participants.length - 6}
        </li>
      )}
    </ul>
  )
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onAdd(title.trim())
        setTitle('')
      }}
      className="flex w-72 shrink-0 items-center gap-2 rounded-xl bg-slate-200/40 p-3"
    >
      <Plus size={16} className="text-slate-500" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a column"
        aria-label="New column title"
        maxLength={60}
        className="flex-1 bg-transparent text-sm placeholder:text-slate-500 focus:outline-none"
      />
    </form>
  )
}

function NamePrompt({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onDone(name)
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold">What should others call you?</h1>
        <p className="mt-1 text-sm text-slate-500">Your name is shown next to the changes you make.</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          aria-label="Your name"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:outline-none"
        />
        <button className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white hover:bg-teal-800">Join board</button>
      </form>
    </div>
  )
}
