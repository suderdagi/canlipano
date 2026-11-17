/**
 * Token bucket per connection: a socket can send `capacity` events in a burst and then
 * `refillPerSecond` events per second. Protects the database from a buggy or abusive client.
 */
export function createRateLimiter(capacity = 30, refillPerSecond = 10) {
  let tokens = capacity
  let last = Date.now()

  return function allow(): boolean {
    const now = Date.now()
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSecond)
    last = now
    if (tokens < 1) return false
    tokens -= 1
    return true
  }
}
