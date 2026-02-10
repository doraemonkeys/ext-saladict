/**
 * Open pdf link directly
 */

import { addConfigListener } from '@/_helpers/config-manager'
import { openUrl } from '@/_helpers/browser-api'
import { getAppConfig } from './state'

/**
 * MV3: Register webRequest listeners synchronously at the top level so they
 * survive service-worker restarts. The actual handlers guard on
 * `getAppConfig()?.pdfSniff` at runtime, so they are no-ops until config is
 * loaded and only act when PDF sniffing is enabled.
 */
export function init() {
  // Always register listeners synchronously (MV3 requirement).
  startListening()

  // Dynamically start/stop listeners when the user toggles pdfSniff.
  addConfigListener(({ newConfig, oldConfig }) => {
    if (newConfig) {
      if (!oldConfig || newConfig.pdfSniff !== oldConfig.pdfSniff) {
        if (newConfig.pdfSniff) {
          startListening()
        } else {
          stopListening()
        }
      }
    }
  })
}

/**
 * @param url provide a url
 * @param force load the current tab anyway
 */
export async function openPDF(url?: string, force?: boolean) {
  let pdfURL = browser.runtime.getURL('assets/pdf/web/viewer.html')

  if (url) {
    pdfURL += '?file=' + encodeURIComponent(url)
  } else {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs.length > 0 && tabs[0].url) {
      const curURL = tabs[0].url
      if (curURL.startsWith(pdfURL)) {
        if (getAppConfig().pdfStandalone) {
          if (tabs[0].id != null) {
            await browser.tabs.remove(tabs[0].id).catch(() => {})
          }
          pdfURL = curURL
        } else {
          return // ignore pdf viewer url
        }
      } else if (force || curURL.endsWith('pdf')) {
        pdfURL += '?file=' + encodeURIComponent(curURL)
      }
    }
  }

  return getAppConfig().pdfStandalone
    ? openPDFStandalone(pdfURL)
    : openUrl({ url: pdfURL, unique: false })
}

export function extractPDFUrl(fullurl?: string): string | void {
  if (!fullurl) {
    return
  }
  const searchURL = new URL(fullurl)
  return decodeURIComponent(searchURL.searchParams.get('file') || '')
}

function startListening() {
  if (!browser.webRequest.onBeforeRequest.hasListener(otherPdfListener)) {
    browser.webRequest.onBeforeRequest.addListener(
      otherPdfListener,
      {
        urls: [
          'ftp://*/*.pdf',
          'ftp://*/*.PDF',
          'file://*/*.pdf',
          'file://*/*.PDF'
        ],
        types: ['main_frame', 'sub_frame']
      }
      // MV3: no 'blocking' — listener is non-blocking
    )
  }

  if (!browser.webRequest.onHeadersReceived.hasListener(httpPdfListener)) {
    browser.webRequest.onHeadersReceived.addListener(
      httpPdfListener,
      {
        urls: ['https://*/*', 'https://*/*', 'http://*/*', 'http://*/*'],
        types: ['main_frame', 'sub_frame']
      },
      ['responseHeaders']
      // MV3: removed 'blocking' — listener is non-blocking
    )
  }
}

function stopListening() {
  browser.webRequest.onBeforeRequest.removeListener(otherPdfListener)
  browser.webRequest.onHeadersReceived.removeListener(httpPdfListener)
}

function otherPdfListener({
  tabId,
  url
}: Parameters<
  Parameters<typeof browser.webRequest.onBeforeRequest.removeListener>[0]
>[0]) {
  const config = getAppConfig()
  if (!config || !config.pdfSniff) return

  const matchURL = ([r]: ReadonlyArray<string>) => new RegExp(r).test(url)
  if (
    config.pdfBlacklist.some(matchURL) &&
    !config.pdfWhitelist.some(matchURL)
  ) {
    return
  }

  const redirectUrl = browser.runtime.getURL(
    `assets/pdf/web/viewer.html?file=${encodeURIComponent(url)}`
  )

  // MV3: non-blocking — use async tabs.update instead of returning redirectUrl
  if (tabId !== -1 && config.pdfStandalone === 'always') {
    // Stop current tab and open standalone window
    chrome.tabs.update(tabId, { url: 'about:blank' }, () => {
      void chrome.runtime.lastError
    })
    openPDFStandalone(redirectUrl)
    return
  }

  if (tabId !== -1) {
    chrome.tabs.update(tabId, { url: redirectUrl }, () => {
      void chrome.runtime.lastError
    })
  }
}

function httpPdfListener({
  tabId,
  responseHeaders,
  url
}: Parameters<
  Parameters<typeof browser.webRequest.onHeadersReceived.removeListener>[0]
>[0]) {
  if (!responseHeaders) {
    return
  }
  const config = getAppConfig()
  if (!config || !config.pdfSniff) return

  const matchURL = ([r]: ReadonlyArray<string>) => new RegExp(r).test(url)
  if (
    config.pdfBlacklist.some(matchURL) &&
    !config.pdfWhitelist.some(matchURL)
  ) {
    return
  }

  const contentTypeHeader = responseHeaders.find(
    ({ name }) => name.toLowerCase() === 'content-type'
  )
  if (contentTypeHeader && contentTypeHeader.value) {
    const contentType = contentTypeHeader.value.toLowerCase()
    if (
      contentType.endsWith('pdf') ||
      (contentType === 'application/octet-stream' && url.endsWith('.pdf'))
    ) {
      const redirectUrl = browser.runtime.getURL(
        `assets/pdf/web/viewer.html?file=${encodeURIComponent(url)}`
      )

      // MV3: non-blocking — use async tabs.update instead of returning redirectUrl
      if (tabId !== -1 && config.pdfStandalone === 'always') {
        // Stop current tab and open standalone window
        chrome.tabs.update(tabId, { url: 'about:blank' }, () => {
          void chrome.runtime.lastError
        })
        openPDFStandalone(redirectUrl)
        return
      }

      if (tabId !== -1) {
        chrome.tabs.update(tabId, { url: redirectUrl }, () => {
          void chrome.runtime.lastError
        })
      }
    }
  }
}

function openPDFStandalone(url: string) {
  return browser.windows.create({ type: 'popup', url })
}
