/**
 * Offscreen document lifecycle management.
 *
 * Chrome allows at most ONE offscreen document per extension.
 * The document may be automatically closed after a period of inactivity,
 * so we create it on demand before each operation and handle recovery
 * when communication fails (i.e. the document was closed unexpectedly).
 */

import { OffscreenMessage, OffscreenResponse } from './types'

const OFFSCREEN_URL = 'offscreen.html'

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the offscreen document exists, creating it if necessary.
 *
 * Uses `chrome.runtime.getContexts()` (Chrome 116+) to detect an existing
 * offscreen document before attempting to create a new one.
 */
export async function ensureOffscreenDocument(): Promise<void> {
  // Check whether an offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  })

  if (existingContexts.length > 0) return

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [
      chrome.offscreen.Reason.AUDIO_PLAYBACK,
      chrome.offscreen.Reason.CLIPBOARD
    ],
    justification: 'Audio playback and clipboard operations'
  })
}

// ---------------------------------------------------------------------------
// Messaging helpers (with automatic recovery)
// ---------------------------------------------------------------------------

/**
 * Send a message to the offscreen document.
 *
 * Every message is tagged with `target: 'offscreen'` so the offscreen
 * listener can ignore messages from other sources (content scripts, popup,
 * etc.) that share the same `chrome.runtime.onMessage` channel.
 *
 * If the first attempt fails (e.g. the document was auto-closed),
 * the function recreates the document and retries **once**.
 */
export async function sendOffscreenMessage(
  message: OffscreenMessage
): Promise<OffscreenResponse> {
  await ensureOffscreenDocument()

  const tagged = { ...message, target: 'offscreen' as const }

  try {
    const response: OffscreenResponse =
      await chrome.runtime.sendMessage(tagged)
    return response
  } catch {
    // Communication failure — the offscreen document was likely closed.
    // Recreate and retry once.
    await ensureOffscreenDocument()
    const response: OffscreenResponse =
      await chrome.runtime.sendMessage(tagged)
    return response
  }
}
