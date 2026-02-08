/**
 * Message types exchanged between the background service worker
 * and the offscreen document.
 */

export type OffscreenMessage =
  | { type: 'PLAY_AUDIO'; url: string }
  | { type: 'STOP_AUDIO' }
  | { type: 'COPY_TO_CLIPBOARD'; text: string }
  | { type: 'READ_CLIPBOARD' }

/**
 * Generic response from the offscreen document.
 */
export type OffscreenResponse =
  | { success: true; text?: string }
  | { success: false; error: string }
