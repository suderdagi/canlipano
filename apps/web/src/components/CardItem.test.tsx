// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DndContext, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '@canlipano/shared'
import { KEYBOARD_CODES } from '../lib/keyboardCodes'
import { SortableCard } from './CardItem'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const card: Card = {
  id: 'c1',
  boardId: 'b1',
  columnId: 'col1',
  title: 'Write the tests',
  description: '',
  color: 'gray',
  position: 'i',
  updatedAt: '2026-11-18T10:00:00.000Z',
  updatedBy: null,
}

/** The card with the same keyboard settings as the board */
function Harness({ onOpen }: { onOpen: () => void }) {
  const sensors = useSensors(useSensor(KeyboardSensor, { keyboardCodes: KEYBOARD_CODES }))
  return (
    <DndContext sensors={sensors}>
      <SortableContext items={[card.id]}>
        <ul>
          <SortableCard card={card} onOpen={onOpen} />
        </ul>
      </SortableContext>
    </DndContext>
  )
}

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  document.body.innerHTML = ''
})

function mount(onOpen: () => void) {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(<Harness onOpen={onOpen} />))
  return container.querySelector('li') as HTMLLIElement
}

const press = (el: Element, code: string, key: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true }))
  })

// dnd-kit starts listening for the keys that end a drag one tick after the card is picked up
const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)))

describe('a card used with the keyboard', () => {
  it('opens with Enter and does not start a drag', () => {
    const onOpen = vi.fn()
    const li = mount(onOpen)
    press(li, 'Enter', 'Enter')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(li.getAttribute('aria-pressed')).not.toBe('true')
  })

  it('is picked up with Space, without opening', () => {
    const onOpen = vi.fn()
    const li = mount(onOpen)
    press(li, 'Space', ' ')
    expect(li.getAttribute('aria-pressed')).toBe('true')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('is dropped with Enter while it is being carried, without opening', async () => {
    const onOpen = vi.fn()
    const li = mount(onOpen)
    press(li, 'Space', ' ')
    await tick()
    press(li, 'Enter', 'Enter')
    expect(onOpen).not.toHaveBeenCalled()
    expect(li.getAttribute('aria-pressed')).not.toBe('true')
  })
})
