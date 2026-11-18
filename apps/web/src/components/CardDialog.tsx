import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Trash2, X } from 'lucide-react'
import { CARD_COLORS, type Card, type UpdateCardInput } from '@canlipano/shared'
import { cardChanges } from '../lib/cardChanges'
import { COLOR_CLASSES } from './CardItem'

interface Props {
  card: Card | null
  onClose: () => void
  onSave: (input: UpdateCardInput) => void
  onDelete: (id: string) => void
}

export function CardDialog({ card, onClose, onSave, onDelete }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // What the fields held when the card was opened: only real changes are saved (see cardChanges)
  const opened = useRef({ title: '', description: '' })

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description)
      opened.current = { title: card.title, description: card.description }
      if (!ref.current?.open) ref.current?.showModal()
    } else {
      ref.current?.close()
    }
    // Only reset the fields when a different card is opened, not on every live update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id])

  if (!card) return <dialog ref={ref} />

  const save = () => {
    const changes = cardChanges(card.id, opened.current, { title, description })
    if (changes) onSave(changes)
    onClose()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && save()}
      aria-labelledby="card-dialog-title"
      className="m-auto w-full max-w-lg rounded-2xl bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <input
            id="card-dialog-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Card title"
            maxLength={200}
            className="flex-1 rounded-md px-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          />
          <button onClick={save} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="card-description">
          Description
        </label>
        <textarea
          id="card-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Add more details…"
          className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-teal-600 focus:outline-none"
        />

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Label</p>
        <div className="mt-2 flex gap-2">
          {CARD_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onSave({ id: card.id, color })}
              aria-label={`Label ${color}`}
              aria-pressed={card.color === color}
              className={clsx('h-7 w-7 rounded-full', COLOR_CLASSES[color], card.color === color && 'ring-2 ring-slate-900 ring-offset-2')}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => {
              onDelete(card.id)
              onClose()
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={save} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            Save
          </button>
        </div>
      </div>
    </dialog>
  )
}
