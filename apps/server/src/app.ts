import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import * as boards from './boards'

const WEB_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist')

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(express.json({ limit: '10kb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.post('/api/boards', async (req, res) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Board name is required' })
    res.status(201).json(await boards.createBoard(parsed.data.name))
  })

  // In production one service serves both the API and the built React app
  if (existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST))
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')))
  }

  return app
}
