import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Users, Zap, MousePointerClick } from 'lucide-react'
import { recentBoards } from '../lib/recentBoards'

const FEATURES = [
  { icon: Zap, title: 'Instant', text: 'Changes show up for everyone the moment they happen.' },
  { icon: Users, title: 'See who is here', text: 'Everyone on the board is shown at the top.' },
  { icon: MousePointerClick, title: 'Drag and drop', text: 'Move cards between columns with mouse or keyboard.' },
]

export function HomePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recent = recentBoards()

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'My board' }),
      })
      if (!res.ok) throw new Error()
      const board = await res.json()
      navigate(`/b/${board.id}`)
    } catch {
      setError('Could not create the board. Is the server running?')
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="" className="h-10 w-10" />
        <span className="text-2xl font-bold tracking-tight">CanlıPano</span>
      </div>
      <h1 className="mt-10 text-4xl font-bold tracking-tight">A task board your whole team edits live</h1>
      <p className="mt-4 text-lg text-slate-600">
        Create a board, share the link and work on it together. No sign up needed.
      </p>

      <form onSubmit={create} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board name, e.g. Sprint 12"
          aria-label="Board name"
          maxLength={60}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
        />
        <button
          disabled={creating}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create board'} <ArrowRight size={18} />
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your recent boards</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {recent.map((b) => (
              <li key={b.id}>
                <Link to={`/b/${b.id}`} className="block rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium hover:border-teal-400">
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <Icon className="text-teal-700" size={20} />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
