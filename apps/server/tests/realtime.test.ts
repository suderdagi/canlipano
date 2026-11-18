import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Server } from 'socket.io'
import { io as connect, type Socket } from 'socket.io-client'
import request from 'supertest'
import {
  compareByPosition,
  type Ack,
  type BoardSnapshot,
  type Card,
  type ClientToServerEvents,
  type Participant,
  type ServerToClientEvents,
} from '@canlipano/shared'
import { createApp } from '../src/app'
import * as boards from '../src/boards'
import { prisma } from '../src/db'
import { registerSocketHandlers, type IO } from '../src/socket'

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

let httpServer: HttpServer
let url: string
const app = createApp()
const clients: Client[] = []

beforeAll(async () => {
  httpServer = createServer(app)
  registerSocketHandlers(new Server(httpServer) as IO)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve))
  await prisma.$disconnect()
})

beforeEach(() => prisma.board.deleteMany())
afterEach(() => {
  clients.splice(0).forEach((c) => c.disconnect())
})

const person = (name: string): Participant => ({ id: `id-${name}`, name, color: '#ea580c' })

/** Sends an event and resolves with the acknowledgement, failing the test on errors. */
function emit<T>(client: Client, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    ;(client.emit as (e: string, p: unknown, ack: (res: Ack<T>) => void) => void)(event, payload, (res) =>
      res.ok ? resolve(res.data) : reject(new Error(res.error))
    )
  })
}

async function joinAs(name: string, boardId: string) {
  const client: Client = connect(url, { transports: ['websocket'], forceNew: true })
  clients.push(client)
  const snapshot = await emit<BoardSnapshot>(client, 'board:join', { boardId, participant: person(name) })
  return { client, snapshot }
}

const nextEvent = <T>(client: Client, event: keyof ServerToClientEvents) =>
  new Promise<T>((resolve) => client.once(event, ((data: T) => resolve(data)) as never))

async function newBoard() {
  const res = await request(app).post('/api/boards').send({ name: 'Sprint 12' }).expect(201)
  return res.body.id as string
}

describe('boards', () => {
  it('creates a board with three default columns', async () => {
    const id = await newBoard()
    const { snapshot } = await joinAs('Sude', id)
    expect(snapshot.columns.map((c) => c.title)).toEqual(['To do', 'In progress', 'Done'])
  })

  it('rejects joining a board that does not exist', async () => {
    await expect(joinAs('Sude', 'nope')).rejects.toThrow('Board not found')
  })
})

describe('real-time sync', () => {
  it('shows a card created by one person to everyone else instantly', async () => {
    const id = await newBoard()
    const sude = await joinAs('Sude', id)
    const ali = await joinAs('Ali', id)
    const todo = sude.snapshot.columns[0].id

    const received = nextEvent<Card>(ali.client, 'card:upserted')
    const created = await emit<Card>(sude.client, 'card:create', { columnId: todo, title: 'Write tests' })

    expect(await received).toEqual(created)
    expect(created.updatedBy).toBe('Sude')
  })

  it('tracks who is online and removes people when they leave', async () => {
    const id = await newBoard()
    const sude = await joinAs('Sude', id)

    const joined = nextEvent<Participant[]>(sude.client, 'presence:update')
    const ali = await joinAs('Ali', id)
    expect((await joined).map((p) => p.name).sort()).toEqual(['Ali', 'Sude'])

    const left = nextEvent<Participant[]>(sude.client, 'presence:update')
    ali.client.disconnect()
    expect((await left).map((p) => p.name)).toEqual(['Sude'])
  })

  it('does not leak changes to other boards', async () => {
    const [boardA, boardB] = [await newBoard(), await newBoard()]
    const sude = await joinAs('Sude', boardA)
    const other = await joinAs('Ali', boardB)

    let leaked = false
    other.client.on('card:upserted', () => (leaked = true))
    await emit(sude.client, 'card:create', { columnId: sude.snapshot.columns[0].id, title: 'Secret' })
    await new Promise((r) => setTimeout(r, 100))

    expect(leaked).toBe(false)
    // A card id from another board can't be changed either
    const otherCard = await emit<Card>(other.client, 'card:create', { columnId: other.snapshot.columns[0].id, title: 'B' })
    await expect(emit(sude.client, 'card:delete', { id: otherCard.id })).rejects.toThrow('Card not found')
  })
})

describe('moving cards', () => {
  async function boardWithCards(titles: string[]) {
    const id = await newBoard()
    const { client, snapshot } = await joinAs('Sude', id)
    const [todo, doing] = snapshot.columns
    const cards: Card[] = []
    for (const title of titles) cards.push(await emit<Card>(client, 'card:create', { columnId: todo.id, title }))
    return { client, todo, doing, cards, boardId: id }
  }

  const order = async (boardId: string, columnId: string) =>
    (await prisma.card.findMany({ where: { boardId, columnId } })).sort(compareByPosition).map((c) => c.title)

  it('reorders cards inside a column and across columns', async () => {
    const { client, todo, doing, cards, boardId } = await boardWithCards(['A', 'B', 'C'])

    await emit(client, 'card:move', { id: cards[2].id, columnId: todo.id, beforeId: cards[0].id }) // C to the top
    expect(await order(boardId, todo.id)).toEqual(['C', 'A', 'B'])

    await emit(client, 'card:move', { id: cards[0].id, columnId: doing.id, beforeId: null }) // A to "In progress"
    expect(await order(boardId, todo.id)).toEqual(['C', 'B'])
    expect(await order(boardId, doing.id)).toEqual(['A'])
  })

  it('keeps a consistent order when many moves happen at the same time', async () => {
    const { client, todo, doing, cards, boardId } = await boardWithCards(['A', 'B', 'C', 'D', 'E', 'F'])

    // Everyone drops a card at the end of "In progress" at the same moment
    await Promise.all(cards.map((c) => emit(client, 'card:move', { id: c.id, columnId: doing.id, beforeId: null })))

    const moved = await prisma.card.findMany({ where: { boardId, columnId: doing.id } })
    expect(moved).toHaveLength(6)
    expect(new Set(moved.map((c) => c.position)).size).toBe(6) // no two cards share a position
    expect(await order(boardId, todo.id)).toEqual([])
  })

  it('validates input', async () => {
    const { client, todo } = await boardWithCards([])
    await expect(emit(client, 'card:create', { columnId: todo.id, title: '   ' })).rejects.toThrow('Title is required')
  })
})

describe('columns', () => {
  it('gives columns created at the same moment different positions', async () => {
    const id = await newBoard()
    const { client } = await joinAs('Sude', id)

    await Promise.all(Array.from({ length: 6 }, (_, i) => emit(client, 'column:create', { title: `Column ${i}` })))

    const columns = await prisma.column.findMany({ where: { boardId: id } })
    expect(columns).toHaveLength(9) // 3 default + 6 new
    expect(new Set(columns.map((c) => c.position)).size).toBe(9)
  })
})

describe('malformed and failing requests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('survives join requests that have no acknowledgement callback', async () => {
    const id = await newBoard()
    const client: Client = connect(url, { transports: ['websocket'], forceNew: true })
    clients.push(client)

    // Calling a missing callback used to throw inside the handler and stop the whole server
    const raw = client as unknown as { emit: (event: string, payload: unknown) => void }
    raw.emit('board:join', {})
    raw.emit('board:join', { boardId: id, participant: person('Sude') })
    await new Promise((r) => setTimeout(r, 150))

    const { snapshot } = await joinAs('Ali', id)
    expect(snapshot.board.id).toBe(id)
  })

  it('answers with an error, not a crash, when the database fails during join', async () => {
    const id = await newBoard()
    vi.spyOn(boards, 'getSnapshot').mockRejectedValueOnce(new Error('connection lost'))

    await expect(joinAs('Sude', id)).rejects.toThrow('Something went wrong')
    expect((await joinAs('Sude', id)).snapshot.board.id).toBe(id) // the next attempt works
  })

  it('rate limits join requests like every other event', async () => {
    const id = await newBoard()
    const client: Client = connect(url, { transports: ['websocket'], forceNew: true })
    clients.push(client)

    const results = await Promise.all(
      Array.from(
        { length: 100 },
        () =>
          new Promise<Ack<BoardSnapshot>>((resolve) =>
            client.emit('board:join', { boardId: id, participant: person('Sude') }, resolve)
          )
      )
    )

    const accepted = results.filter((r) => r.ok).length
    expect(accepted).toBeGreaterThan(0)
    expect(accepted).toBeLessThanOrEqual(40) // burst of 30 plus a little refill
    expect(results.find((r) => !r.ok)).toMatchObject({ error: 'Too many changes, slow down' })
  })

  it('tells the old board when a connection moves to another board', async () => {
    const [boardA, boardB] = [await newBoard(), await newBoard()]
    const sude = await joinAs('Sude', boardA)
    const ali = await joinAs('Ali', boardA)

    const update = nextEvent<Participant[]>(ali.client, 'presence:update')
    await emit(sude.client, 'board:join', { boardId: boardB, participant: person('Sude') })

    expect((await update).map((p) => p.name)).toEqual(['Ali'])
  })
})
