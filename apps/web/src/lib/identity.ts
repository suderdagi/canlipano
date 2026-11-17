import type { Participant } from '@canlipano/shared'

const KEY = 'canlipano.me'
const COLORS = ['#0f766e', '#ea580c', '#7c3aed', '#db2777', '#2563eb', '#ca8a04', '#059669', '#dc2626']

/** There are no accounts: each browser gets a random id and the name the person types once. */
export function loadIdentity(): Participant | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return saved?.id && saved?.name ? saved : null
  } catch {
    return null
  }
}

export function saveIdentity(name: string): Participant {
  const participant: Participant = {
    id: loadIdentity()?.id ?? crypto.randomUUID(),
    name: name.trim(),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
  localStorage.setItem(KEY, JSON.stringify(participant))
  return participant
}
