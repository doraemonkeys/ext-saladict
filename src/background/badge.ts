import { message } from '@/_helpers/browser-api'
import { Subject } from 'rxjs'
import { switchMapBy } from '@/_helpers/observables'
import { timer } from '@/_helpers/promise-more'
import { getAppConfig } from './state'

// Static imports of all locale background files
import { locale as localeEn } from '@/_locales/en/background'
import { locale as localeZhCN } from '@/_locales/zh-CN/background'
import { locale as localeZhTW } from '@/_locales/zh-TW/background'
import { locale as localeEs } from '@/_locales/es/background'
import { locale as localeNe } from '@/_locales/ne/background'

const locales: Record<string, typeof localeZhCN> = {
  en: localeEn,
  'zh-CN': localeZhCN,
  'zh-TW': localeZhTW,
  es: localeEs,
  ne: localeNe
}

function getLocale() {
  return locales[getAppConfig().langCode] || locales.en
}

interface UpdateBadgeOptions {
  active: boolean
  tempDisable: boolean
  unsupported: boolean
}

const onUpdated$ = new Subject<{
  delay?: boolean
  tabId: number
  options?: UpdateBadgeOptions
}>()

onUpdated$
  .pipe(
    switchMapBy('tabId', async o => {
      if (o.options) {
        return o as Required<typeof o>
      }

      if (o.delay) {
        await timer(1000)
      }

      return {
        tabId: o.tabId,
        options: (await message
          .send<'GET_TAB_BADGE_INFO'>(o.tabId, {
            type: 'GET_TAB_BADGE_INFO'
          })
          .catch(() => {})) || {
          active: getAppConfig().active,
          tempDisable: false,
          unsupported: true
        }
      }
    })
  )
  .subscribe(({ tabId, options }) => {
    if (!options.active) {
      return setOff(tabId)
    }

    if (options.tempDisable) {
      return setTempOff(tabId)
    }

    if (options.unsupported) {
      return setUnsupported(tabId)
    }

    return setDefault(tabId)
  })

export function initBadge() {
  /** Sent when content script loaded */
  message.addListener('SEND_TAB_BADGE_INFO', ({ payload }, sender) => {
    if (sender.tab && sender.tab.id) {
      onUpdated$.next({ tabId: sender.tab.id, options: payload })
    }
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      onUpdated$.next({ tabId, delay: true })
    }
  })
}

function setOff(tabId: number) {
  setIcon(true, tabId)
  chrome.action.setTitle({ title: getLocale().app.off, tabId }, () => {
    void chrome.runtime.lastError
  })
}

function setTempOff(tabId: number) {
  setIcon(true, tabId)
  chrome.action.setTitle({ title: getLocale().app.tempOff, tabId }, () => {
    void chrome.runtime.lastError
  })
}

function setUnsupported(tabId: number) {
  setIcon(true, tabId)
  chrome.action.setTitle({ title: getLocale().app.unsupported, tabId }, () => {
    void chrome.runtime.lastError
  })
}

function setDefault(tabId: number) {
  setIcon(false, tabId)
  // browser.browserAction.setBadgeText({ text: '', tabId })
  // browser.action.setTitle({ title: '', tabId })
}

function setIcon(gray: boolean, tabId: number) {
  chrome.action.setIcon({
    tabId,
    path: gray
      ? {
          16: 'assets/icon-gray-16.png',
          19: 'assets/icon-gray-19.png',
          24: 'assets/icon-gray-24.png',
          38: 'assets/icon-gray-38.png',
          48: 'assets/icon-gray-48.png',
          128: 'assets/icon-gray-128.png'
        }
      : {
          16: 'assets/icon-16.png',
          19: 'assets/icon-19.png',
          24: 'assets/icon-24.png',
          38: 'assets/icon-38.png',
          48: 'assets/icon-48.png',
          128: 'assets/icon-128.png'
        }
  }, () => {
    void chrome.runtime.lastError
  })
}
