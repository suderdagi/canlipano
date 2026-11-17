import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { logger } from './logger'
import { registerSocketHandlers, type SocketData } from './socket'
import type { ClientToServerEvents, ServerToClientEvents } from '@canlipano/shared'
import { prisma } from './db'

const port = Number(process.env.PORT ?? 4000)
const httpServer = createServer(createApp())

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  // In development the Vite dev server runs on another port
  cors: process.env.NODE_ENV === 'production' ? undefined : { origin: 'http://localhost:5173' },
})
registerSocketHandlers(io)

httpServer.listen(port, () => logger.info(`canlipano server on http://localhost:${port}`))

async function shutdown() {
  io.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
