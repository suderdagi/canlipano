import { useState } from 'react'
import { clsx } from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { Card, Column } from '@canlipano/shared'
import { SortableCard } from './CardItem'

interface Props {
  column: Column
  cards: Card[]
  onAddCard: (title: string) => void
  onRename: (title: string) => void
  onOpenCard: (card: Card) => void
}

export function ColumnView({ column, cards, onAddCard, onRename, onOpenCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } })
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)

  const submit = () => {
    if (title.trim()) onAddCard(title.trim())
    setTitle('')
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={column.title}
      className={clsx(
        'flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-200/70 transition-colors',
        isOver && 'bg-teal-100'
      )}
    >
      <header className="flex items-center justify-between px-3 pb-2 pt-3">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={column.title}
            aria-label="Column title"
            maxLength={60}
            onBlur={(e) => {
              setEditingTitle(false)
              if (e.target.value.trim() && e.target.value.trim() !== column.title) onRename(e.target.value.trim())
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
            }}
            className="w-full rounded border border-teal-500 px-2 py-0.5 text-sm font-semibold"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="text-left text-sm font-semibold hover:text-teal-800" title="Rename">
            {column.title}
          </button>
        )}
        <span className="ml-2 rounded-full bg-white/70 px-2 text-xs text-slate-500">{cards.length}</span>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-12 flex-col gap-2 overflow-y-auto px-3 pb-2">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onOpen={() => onOpenCard(card)} />
          ))}
        </ul>
      </SortableContext>

      <div className="px-3 pb-3">
        {adding ? (
          <div>
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder="What needs to be done?"
              aria-label="New card title"
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-none"
            />
            <div className="mt-1 flex gap-2">
              <button onClick={submit} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
                Add
              </button>
              <button onClick={() => setAdding(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-300/50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-300/50"
          >
            <Plus size={16} /> Add a card
          </button>
        )}
      </div>
    </section>
  )
}
