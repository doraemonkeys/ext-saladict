import { openUrl } from '@/_helpers/browser-api'
import { sendOffscreenMessage } from '@/offscreen/lifecycle'

export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    !(await browser.permissions.contains({ permissions: ['clipboardWrite'] }))
  ) {
    openUrl(
      '/options.html?menuselected=Permissions&missing_permission=clipboardWrite',
      true
    )
    return
  }

  const result = await sendOffscreenMessage({
    type: 'COPY_TO_CLIPBOARD',
    text
  })
  if (!result.success) {
    console.warn('[clipboard] Copy failed:', result.error)
  }
}

export async function getTextFromClipboard(): Promise<string> {
  if (
    !(await browser.permissions.contains({ permissions: ['clipboardRead'] }))
  ) {
    openUrl(
      '/options.html?menuselected=Permissions&missing_permission=clipboardRead',
      true
    )
    return ''
  }

  if (process.env.NODE_ENV === 'development') {
    return 'clipboard content'
  }

  const result = await sendOffscreenMessage({ type: 'READ_CLIPBOARD' })
  if (result.success) {
    return result.text || ''
  }
  console.warn('[clipboard] Read failed:', result.error)
  return ''
}
