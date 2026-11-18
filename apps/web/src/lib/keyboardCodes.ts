/**
 * Which keys drive a card with the keyboard sensor. Space picks a card up; Space or Enter drops it.
 * Enter is not a way to start a drag: on a card that is not being dragged it opens the card.
 */
export const KEYBOARD_CODES = { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] }
