import { timer } from '@/_helpers/promise-more'
import { sendOffscreenMessage } from '@/offscreen/lifecycle'

/**
 * To make sure only one audio plays at a time.
 *
 * MV3: Audio playback is delegated to the offscreen document
 * since Service Workers have no access to HTMLAudioElement / Audio API.
 */
export class AudioManager {
  private static instance: AudioManager

  static getInstance() {
    return AudioManager.instance || (AudioManager.instance = new AudioManager())
  }

  // singleton
  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  currentSrc?: string

  async reset() {
    await sendOffscreenMessage({ type: 'STOP_AUDIO' })
    this.currentSrc = ''
  }

  async play(src?: string): Promise<void> {
    if (!src || src === this.currentSrc) {
      await this.reset()
      return
    }

    this.currentSrc = src

    // Fire-and-forget the play request; use a timeout as a safety net
    const playResult = sendOffscreenMessage({ type: 'PLAY_AUDIO', url: src })

    await Promise.race([playResult, timer(20000)])

    this.currentSrc = ''
  }
}
