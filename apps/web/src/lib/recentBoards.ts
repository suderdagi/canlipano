const KEY = 'canlipano.recent'

export interface RecentBoard {
  id: string
  name: string
  openedAt: string
}

export function recentBoards(): RecentBoard[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function rememberBoard(id: string, name: string) {
  const list = [{ id, name, openedAt: new Date().toISOString() }, ...recentBoards().filter((b) => b.id !== id)].slice(0, 8)
  localStorage.setItem(KEY, JSON.stringify(list))
}
