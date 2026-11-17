import { clsx } from 'clsx'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlignLeft } from 'lucide-react'
import type { Card } from '@canlipano/shared'

export const COLOR_CLASSES: Record<Card['color'], string> = {
  gray: 'bg-slate-300',
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
}

export function CardView({ card, dragging = false }: { card: Card; dragging?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm',
        dragging && 'rotate-2 shadow-lg ring-2 ring-teal-500/40'
      )}
    >
      {card.color !== 'gray' && <div className={clsx('mb-2 h-1.5 w-10 rounded-full', COLOR_CLASSES[card.color])} />}
      <p className="font-medium leading-snug">{card.title}</p>
      {(card.description || card.updatedBy) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          {card.description && <AlignLeft size={13} aria-label="Has description" />}
          {card.updatedBy && <span className="truncate">edited by {card.updatedBy}</span>}
        </div>
      )}
    </div>
  )
}

export function SortableCard({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('cursor-grab list-none active:cursor-grabbing', isDragging && 'opacity-30')}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      {...attributes}
      {...listeners}
    >
      <CardView card={card} />
    </li>
  )
}
