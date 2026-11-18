import { describe, expect, it } from 'vitest'
import { cardChanges } from './cardChanges'

const opened = { title: 'Write docs', description: 'First draft' }

describe('cardChanges', () => {
  it('returns null when nothing was changed', () => {
    expect(cardChanges('c1', opened, { ...opened })).toBeNull()
  })

  it('sends only the field that was edited', () => {
    expect(cardChanges('c1', opened, { ...opened, description: 'Second draft' })).toEqual({ id: 'c1', description: 'Second draft' })
    expect(cardChanges('c1', opened, { ...opened, title: 'Write the docs' })).toEqual({ id: 'c1', title: 'Write the docs' })
  })

  it('trims the title and ignores a blank one', () => {
    expect(cardChanges('c1', opened, { ...opened, title: '  Write the docs  ' })).toEqual({ id: 'c1', title: 'Write the docs' })
    expect(cardChanges('c1', opened, { ...opened, title: '   ' })).toBeNull()
  })

  it('can clear the description', () => {
    expect(cardChanges('c1', opened, { ...opened, description: '' })).toEqual({ id: 'c1', description: '' })
  })

  it('leaves a field alone that someone else changed while the dialog was open', () => {
    // The dialog was opened with "Write docs"; another person renamed the card since. The person
    // here only edited the description, so the title must not be sent back.
    const changes = cardChanges('c1', opened, { title: opened.title, description: 'Second draft' })
    expect(changes).toEqual({ id: 'c1', description: 'Second draft' })
    expect(changes).not.toHaveProperty('title')
  })
})
