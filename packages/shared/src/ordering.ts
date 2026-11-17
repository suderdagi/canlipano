/**
 * Fractional indexing: every card has a sortable string key, and a new position is a key
 * that sorts between its two neighbours ("a" < "an" < "b"). Moving a card writes ONE row,
 * instead of renumbering every card below it, which matters when several people drag
 * cards at the same time.
 *
 * Keys use base-36 digits and are read like the decimals of a number between 0 and 1.
 * Based on the approach described by Figma and the rocicorp/fractional-indexing library.
 */
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`Invalid range: "${a}" >= "${b}"`)
  if (a.endsWith('0') || b?.endsWith('0')) throw new Error('Keys must not end with 0')

  if (b !== null) {
    // Skip the common prefix: the midpoint shares it
    let n = 0
    while ((a[n] ?? '0') === b[n]) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }

  const digitA = a ? DIGITS.indexOf(a[0]) : 0
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length

  if (digitB - digitA > 1) {
    // There is room for a digit in between
    return DIGITS[Math.round((digitA + digitB) / 2)]
  }

  // Neighbouring digits: keep a's digit and go one level deeper
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return DIGITS[digitA] + midpoint(a.slice(1), null)
}

/**
 * Appending is the most common move (new cards go to the end). Halving the gap to the end
 * every time would add a character every few cards, so instead the first digit that can
 * grow is incremented: "i" -> "j", "zz" -> "zz1". Keys then grow by one character only
 * every ~35 appends.
 */
function increment(key: string): string {
  for (let i = 0; i < key.length; i++) {
    const digit = DIGITS.indexOf(key[i])
    if (digit < DIGITS.length - 1) return key.slice(0, i) + DIGITS[digit + 1]
  }
  return key + DIGITS[1]
}

/** A key that sorts after `before` and before `after`. Pass null for "start" or "end". */
export function keyBetween(before: string | null, after: string | null): string {
  if (before !== null && after === null) return increment(before)
  return midpoint(before ?? '', after)
}

/** Sort helper: by key, ties (possible in rare concurrent cases) broken by id. */
export function compareByPosition(a: { position: string; id: string }, b: { position: string; id: string }) {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1
  return a.id < b.id ? -1 : 1
}
