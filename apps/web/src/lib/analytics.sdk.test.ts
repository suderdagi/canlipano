// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import posthog from 'posthog-js'
import type { CaptureResult } from 'posthog-js'
import { posthogOptions, scrubEvent } from './analytics'

const BOARD_ID = 'Xk3pQ9sTmNaB'

/**
 * Runs the real posthog-js SDK with the app's settings, but swaps the network for a list,
 * so the test sees exactly what would have left the browser.
 */
function realSdk() {
  const sent: CaptureResult[] = []
  const app = [posthogOptions.before_send ?? []].flat() // whatever the app does to events before sending
  const client = posthog.init(
    'phc_test_key',
    {
      ...posthogOptions,
      api_host: 'http://localhost:9',
      persistence: 'localStorage',
      before_send: [
        ...app,
        (event) => {
          sent.push(event)
          return null // nothing is sent
        },
      ],
    },
    `test-${Math.random()}`
  )
  return { client, sent }
}

describe('what the real PostHog SDK would send', () => {
  it('never includes the board id, in any property of any event', () => {
    window.history.pushState({}, '', `/b/${BOARD_ID}`)
    const { client, sent } = realSdk()

    client.identify('person-1')
    client.capture('$pageview', { $pathname: '/b/:boardId' })
    client.capture('card_created')

    expect(sent.map((e) => e.event)).toEqual(expect.arrayContaining(['$identify', '$pageview', 'card_created']))
    expect(JSON.stringify(sent)).not.toContain(BOARD_ID)
    expect(sent.find((e) => e.event === '$pageview')?.properties.$current_url).toBe(`${window.location.origin}/b/:boardId`)
  })

  it('replaces board ids wherever they appear and keeps everything else as it was', () => {
    const when = new Date()
    const event = {
      uuid: 'u',
      event: 'x',
      properties: {
        $current_url: `https://canlipano.example/b/${BOARD_ID}?tab=1#top`,
        $referrer: `https://canlipano.example/b/${BOARD_ID}`,
        $direct: '$direct',
        rows: 3,
        nested: { url: `/b/${BOARD_ID}` },
        list: [`/b/${BOARD_ID}/x`, '/'],
      },
      timestamp: when,
    } as unknown as CaptureResult

    const clean = scrubEvent(event)

    expect(clean.properties).toEqual({
      $current_url: 'https://canlipano.example/b/:boardId?tab=1#top',
      $referrer: 'https://canlipano.example/b/:boardId',
      $direct: '$direct',
      rows: 3,
      nested: { url: '/b/:boardId' },
      list: ['/b/:boardId/x', '/'],
    })
    expect(clean.timestamp).toBe(when) // still the same Date, not an empty object
  })
})
