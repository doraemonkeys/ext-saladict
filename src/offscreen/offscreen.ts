/**
 * Offscreen document script.
 *
 * Runs in a hidden DOM context and handles operations that require DOM APIs
 * which are unavailable in the Service Worker (audio playback, clipboard).
 *
 * Communication with the background service worker happens via
 * `chrome.runtime.onMessage` / `chrome.runtime.sendMessage`.
 */

import { OffscreenMessage, OffscreenResponse } from './types'

// ---------------------------------------------------------------------------
// Create clipboard textarea (needed for copy/paste operations)
// ---------------------------------------------------------------------------

const textarea = document.createElement('textarea')
textarea.id = 'saladict-clipboard'
textarea.setAttribute('aria-hidden', 'true')
textarea.style.position = 'absolute'
textarea.style.left = '-9999px'
document.body.appendChild(textarea)

// ---------------------------------------------------------------------------
// Audio playback
// ---------------------------------------------------------------------------

let currentAudio: HTMLAudioElement | undefined

function resetAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio.onended = null
    currentAudio.onerror = null
  }
  currentAudio = undefined
}

async function playAudio(url: string): Promise<void> {
  resetAudio()

  const audio = new Audio(url)
  currentAudio = audio

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      resetAudio()
      resolve()
    }, 20000)

    audio.onended = () => {
      clearTimeout(timeout)
      resetAudio()
      resolve()
    }

    audio.onerror = () => {
      clearTimeout(timeout)
      const error = (audio.error && audio.error.message) || 'Audio playback failed'
      resetAudio()
      reject(new Error(error))
    }

    audio.play().catch(err => {
      clearTimeout(timeout)
      resetAudio()
      reject(err)
    })
  })
}

// ---------------------------------------------------------------------------
// Clipboard operations
// ---------------------------------------------------------------------------

function copyToClipboard(text: string): boolean {
  const textarea = document.getElementById(
    'saladict-clipboard'
  ) as HTMLTextAreaElement | null
  if (!textarea) return false

  textarea.value = text
  textarea.select()
  const success = document.execCommand('copy')
  textarea.value = ''
  return success
}

function readClipboard(): string {
  const textarea = document.getElementById(
    'saladict-clipboard'
  ) as HTMLTextAreaElement | null
  if (!textarea) return ''

  textarea.value = ''
  textarea.focus()
  document.execCommand('paste')
  const text = textarea.value
  textarea.value = ''
  return text
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: OffscreenMessage & { target?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OffscreenResponse) => void
  ) => {
    // Only handle messages explicitly targeted at the offscreen document.
    // Without this guard, messages from content scripts (e.g. PLAY_AUDIO
    // with a `payload` field instead of `url`) would be intercepted here,
    // causing silent failures and racing with the background's response.
    if (!message || message.target !== 'offscreen') return false

    switch (message.type) {
      case 'PLAY_AUDIO':
        playAudio(message.url)
          .then(() => sendResponse({ success: true }))
          .catch(err =>
            sendResponse({ success: false, error: String(err.message || err) })
          )
        // Return true to indicate we will respond asynchronously
        return true

      case 'STOP_AUDIO':
        resetAudio()
        sendResponse({ success: true })
        return false

      case 'COPY_TO_CLIPBOARD': {
        const ok = copyToClipboard(message.text)
        sendResponse(
          ok
            ? { success: true }
            : { success: false, error: 'Copy command failed' }
        )
        return false
      }

      case 'READ_CLIPBOARD': {
        const text = readClipboard()
        sendResponse({ success: true, text })
        return false
      }

      default:
        // Not a message we handle — let other listeners process it
        return false
    }
  }
)
