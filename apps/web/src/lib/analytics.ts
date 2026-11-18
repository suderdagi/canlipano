/**
 * Product analytics with PostHog.
 *
 * CanlıPano only works if people share their board, so the events follow that funnel:
 * board_created → board_link_copied → board_became_collaborative (a second person is on it)
 * → cards created and moved. Reliability events (action_rejected, reconnected) show where
 * the real-time experience breaks down.
 */
export interface AnalyticsEvents {
  board_created: { custom_name: boolean }
  board_opened: { participants: number }
  board_link_copied: Record<string, never>
  board_became_collaborative: { participants: number }
  card_created: Record<string, never>
  card_moved: { across_columns: boolean }
  card_edited: { fields: string[] }
  card_deleted: Record<string, never>
  column_created: Record<string, never>
  action_rejected: { action: string }
  reconnected: { offline_seconds: number }
}

export type EventName = keyof AnalyticsEvents

export interface AnalyticsSink {
  capture(event: string, properties?: Record<string, unknown>): void
  identify(id: string): void
}

const noopSink: AnalyticsSink = { capture() {}, identify() {} }
let sink: AnalyticsSink = noopSink

export function setAnalyticsSink(next: AnalyticsSink | null) {
  sink = next ?? noopSink
}

export function track<E extends EventName>(
  event: E,
  ...[properties]: AnalyticsEvents[E] extends Record<string, never> ? [] : [AnalyticsEvents[E]]
) {
  sink.capture(event, properties)
}

/** People are identified by the random id their browser got, never by the name they typed. */
export function identify(participantId: string) {
  sink.identify(participantId)
}

/** Board ids are the only key to a board, so pageviews send the route pattern, not the real URL. */
export function trackPageview(pathname: string) {
  sink.capture('$pageview', { $pathname: pathname.startsWith('/b/') ? '/b/:boardId' : pathname })
}

/** Names of the card fields an edit changed, e.g. ['title', 'color']. Values are never sent. */
export function changedFields(input: Record<string, unknown>) {
  return Object.keys(input).filter((key) => key !== 'id' && input[key] !== undefined).sort()
}

const COLLABORATIVE_KEY = 'canlipano.collaborative'

/**
 * A board counts as collaborative the first time this browser sees two or more people on it.
 * Remembered per board so the event is sent once, not on every visit or presence change.
 */
export function isFirstCollaboration(boardId: string, participants: number, storage: Pick<Storage, 'getItem' | 'setItem'>) {
  if (participants < 2) return false
  let seen: string[] = []
  try {
    seen = JSON.parse(storage.getItem(COLLABORATIVE_KEY) ?? '[]')
  } catch {
    // corrupted value: start over
  }
  if (seen.includes(boardId)) return false
  storage.setItem(COLLABORATIVE_KEY, JSON.stringify([...seen, boardId].slice(-50)))
  return true
}

/**
 * Starts PostHog when VITE_POSTHOG_KEY is set at build time; otherwise analytics is a no-op.
 * The SDK is imported lazily so it isn't part of the initial bundle.
 */
export async function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return

  const { default: posthog } = await import('posthog-js')
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: false, // sent on route changes instead, without board ids
    autocapture: false,
    disable_session_recording: true, // boards can contain private notes
    person_profiles: 'identified_only',
  })
  setAnalyticsSink({
    capture: (event, properties) => posthog.capture(event, properties),
    identify: (id) => posthog.identify(id),
  })
}
