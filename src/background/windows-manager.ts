import { message, storage } from '@/_helpers/browser-api'
import { Word } from '@/_helpers/record-manager'
import { isFirefox } from '@/_helpers/saladict'
import { getTitlebarOffset } from '@/_helpers/titlebar-offset'
import { getAppConfig } from './state'

interface WinRect {
  width: number
  height: number
  left: number
  top: number
}

interface ScreenInfo {
  availWidth: number
  availHeight: number
  availTop: number
  availLeft: number
}

/**
 * Get primary display work area via chrome.system.display.getInfo().
 * Falls back to sensible defaults if the API is unavailable.
 */
async function getScreenInfo(): Promise<ScreenInfo> {
  try {
    const displays = await chrome.system.display.getInfo()
    const primary = displays.find(d => d.isPrimary) || displays[0]
    if (primary) {
      return {
        availWidth: primary.workArea.width,
        availHeight: primary.workArea.height,
        availTop: primary.workArea.top,
        availLeft: primary.workArea.left
      }
    }
  } catch (e) {
    console.warn('[windows-manager] chrome.system.display.getInfo failed', e)
  }
  // Fallback defaults
  return {
    availWidth: 1920,
    availHeight: 1080,
    availTop: 0,
    availLeft: 0
  }
}

const safeUpdateWindow: typeof browser.windows.update = (...args) =>
  browser.windows.update(...args).catch(console.warn as (m: any) => undefined)

/**
 * Manipulate main window
 */
export class MainWindowsManager {
  /** Main window snapshot */
  snapshot: browser.windows.Window | null = null

  async correctTop(originTop?: number) {
    if (!originTop) return originTop

    const offset = await getTitlebarOffset()
    if (!offset) return originTop

    return originTop - offset.main
  }

  async focus(): Promise<void> {
    if (this.snapshot && this.snapshot.id != null) {
      await safeUpdateWindow(this.snapshot.id, { focused: true })
    }
  }

  async takeSnapshot(): Promise<browser.windows.Window | null> {
    this.snapshot = null

    try {
      const win = await browser.windows.getLastFocused({
        windowTypes: ['normal']
      })
      if (win.focused && win.type === 'normal' && win.state !== 'minimized') {
        this.snapshot = win
      } else if (isFirefox) {
        // Firefox does not support windowTypes in getLastFocused
        const wins = (await browser.windows.getAll()).filter(
          win =>
            win.focused && win.type === 'normal' && win.state !== 'minimized'
        )
        if (wins.length === 1) {
          this.snapshot = wins[0]
        } else {
          const focusedWins = wins.filter(win => win.focused)
          if (focusedWins.length === 1) {
            this.snapshot = focusedWins[0]
          }
        }
      }
    } catch (e) {
      console.warn(e)
    }

    return this.snapshot
  }

  destroySnapshot(): void {
    this.snapshot = null
  }

  async makeRoomForSidebar(
    side: 'left' | 'right',
    sidebarSnapshot: browser.windows.Window | null
  ): Promise<void> {
    const mainWin = this.snapshot

    if (!mainWin || mainWin.id == null) {
      return
    }

    const sidebarWidth =
      (sidebarSnapshot && sidebarSnapshot.width) || getAppConfig().panelWidth

    let updateInfo: {
      top: number | undefined
      left: number
      width: number
      height: number
      state: 'normal'
    }

    if (
      mainWin.top != null &&
      mainWin.left != null &&
      mainWin.width != null &&
      mainWin.height != null
    ) {
      updateInfo = {
        top: await this.correctTop(mainWin.top),
        left: side === 'right' ? mainWin.left : mainWin.left + sidebarWidth,
        width: mainWin.width - sidebarWidth,
        height: mainWin.height,
        state: 'normal' as 'normal'
      }
    } else {
      const screen = await getScreenInfo()
      updateInfo = {
        top: 0,
        left: side === 'right' ? 0 : sidebarWidth,
        width: screen.availWidth - sidebarWidth,
        height: screen.availHeight,
        state: 'normal' as 'normal'
      }
    }

    if (side === 'right') {
      // fix a chrome bug by moving 1 extra pixal then to 0
      await safeUpdateWindow(mainWin.id, {
        ...updateInfo,
        left: updateInfo.left + 1
      })
    }

    await safeUpdateWindow(mainWin.id, updateInfo)
  }

  async restoreSnapshot(): Promise<void> {
    if (this.snapshot && this.snapshot.id != null) {
      await safeUpdateWindow(
        this.snapshot.id,
        this.snapshot.state === 'normal'
          ? {
              top: await this.correctTop(this.snapshot.top),
              left: this.snapshot.left,
              width: this.snapshot.width,
              height: this.snapshot.height
            }
          : { state: this.snapshot.state }
      )
    }
  }
}

/**
 * Manipulate Standalone Quick Search Panel
 */
export class QsPanelManager {
  private qsPanelId: number | null = null
  private snapshot: browser.windows.Window | null = null
  private isSidebar: boolean = false
  private mainWindowsManager = new MainWindowsManager()

  async correctTop(originTop?: number) {
    if (!originTop) return originTop

    const offset = await getTitlebarOffset()
    if (!offset) return originTop

    return originTop - offset.panel
  }

  /**
   * @param preload force preload word. otherwise let the panel decide.
   */
  async create(preload?: Word): Promise<void> {
    this.isSidebar = false

    let wordString = ''
    let lastTabString = ''

    if (preload) {
      try {
        wordString = '&word=' + encodeURIComponent(JSON.stringify(preload))
      } catch (error) {
        if (process.env.DEBUG) {
          console.error(error)
        }
      }
    } else {
      if (getAppConfig().qsPreload === 'selection') {
        const tab = (
          await browser.tabs.query({
            active: true,
            lastFocusedWindow: true
          })
        )[0]
        if (tab && tab.id) {
          lastTabString = '&lastTab=' + tab.id
        }
      }
    }

    await this.mainWindowsManager.takeSnapshot()

    const qsPanelRect = getAppConfig().qssaSidebar
      ? await this.getSidebarRect(getAppConfig().qssaSidebar)
      : (getAppConfig().qssaRectMemo && (await this.getStorageRect())) ||
        (await this.getDefaultRect())

    let qsPanelWin: browser.windows.Window | undefined

    try {
      qsPanelWin = await browser.windows.create({
        ...qsPanelRect,
        type: 'popup',
        url: browser.runtime.getURL(
          `quick-search.html?sidebar=${
            getAppConfig().qssaSidebar
          }${wordString}${lastTabString}`
        )
      })
    } catch (err) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL(`assets/icon-128.png`),
        title: `Saladict`,
        message: err.message,
        priority: 2,
        eventTime: Date.now() + 5000
      })
    }

    if (qsPanelWin && qsPanelWin.id) {
      if (isFirefox) {
        // Firefox needs an extra push
        safeUpdateWindow(qsPanelWin.id, qsPanelRect)
      }

      this.qsPanelId = qsPanelWin.id

      if (getAppConfig().qssaSidebar) {
        this.isSidebar = true
        await this.mainWindowsManager.makeRoomForSidebar(
          getAppConfig().qssaSidebar,
          qsPanelWin
        )
      }

      if (!getAppConfig().qsFocus) {
        await this.mainWindowsManager.focus()
      }

      // notify all tabs
      ;(await browser.tabs.query({})).forEach(tab => {
        if (tab.id && tab.windowId !== this.qsPanelId) {
          message.send(tab.id, {
            type: 'QS_PANEL_CHANGED',
            payload: this.qsPanelId != null
          })
        }
      })
    }
  }

  async getWin(): Promise<browser.windows.Window | null> {
    if (!this.qsPanelId) {
      return null
    }
    return browser.windows.get(this.qsPanelId).catch(() => null)
  }

  async destroy(): Promise<void> {
    ;(await browser.tabs.query({})).forEach(tab => {
      if (tab.id && tab.windowId !== this.qsPanelId) {
        message.send(tab.id, {
          type: 'QS_PANEL_CHANGED',
          payload: false
        })
      }
    })

    this.qsPanelId = null
    this.isSidebar = false
    this.destroySnapshot()
    await this.mainWindowsManager.restoreSnapshot()
    this.mainWindowsManager.destroySnapshot()
  }

  isQsPanel(winId?: number): boolean {
    return winId != null && winId === this.qsPanelId
  }

  async hasCreated(): Promise<boolean> {
    const win = await this.getWin()
    if (!win) {
      this.qsPanelId = null
    }
    return !!win
  }

  async focus(): Promise<void> {
    if (this.qsPanelId != null) {
      await safeUpdateWindow(this.qsPanelId, { focused: true })
      const [tab] = await browser.tabs.query({ windowId: this.qsPanelId })
      if (tab && tab.id) {
        await message.send(tab.id, { type: 'QS_PANEL_FOCUSED' })
      }
    }
  }

  async takeSnapshot(): Promise<void> {
    if (this.qsPanelId != null) {
      this.snapshot = await browser.windows
        .get(this.qsPanelId)
        .catch(() => null)
    }
  }

  destroySnapshot(): void {
    this.snapshot = null
  }

  async restoreSnapshot(): Promise<void> {
    // restore main window first so that it will be at the bottom
    await this.mainWindowsManager.restoreSnapshot()
    if (this.snapshot != null && this.snapshot.id != null) {
      await safeUpdateWindow(this.snapshot.id, {
        top: await this.correctTop(this.snapshot.top),
        left: this.snapshot.left,
        width: this.snapshot.width,
        height: this.snapshot.height
      })
    } else if (this.qsPanelId != null) {
      await safeUpdateWindow(this.qsPanelId, {
        focused: true,
        ...(await this.getDefaultRect())
      })
    }
    this.destroySnapshot()
  }

  async moveToSidebar(side: 'left' | 'right'): Promise<void> {
    if (this.qsPanelId != null) {
      await this.takeSnapshot()
      await safeUpdateWindow(this.qsPanelId, await this.getSidebarRect(side))
      await this.mainWindowsManager.makeRoomForSidebar(side, this.snapshot)
    }
  }

  async toggleSidebar(side: 'left' | 'right'): Promise<void> {
    if (!(await this.hasCreated())) {
      return
    }

    if (this.isSidebar) {
      await this.restoreSnapshot()
    } else {
      await this.moveToSidebar(side)
    }

    this.isSidebar = !this.isSidebar
  }

  async getDefaultRect(): Promise<WinRect> {
    const { qsLocation, qssaHeight } = getAppConfig()
    const screen = await getScreenInfo()

    let qsPanelLeft = 10
    let qsPanelTop = 30
    const qsPanelWidth = getAppConfig().panelWidth
    const qsPanelHeight = getAppConfig().qssaHeight

    switch (qsLocation) {
      case 'CENTER':
        qsPanelLeft = (screen.availWidth - qsPanelWidth) / 2
        qsPanelTop = (screen.availHeight - qssaHeight) / 2
        break
      case 'TOP':
        qsPanelLeft = (screen.availWidth - qsPanelWidth) / 2
        qsPanelTop = 30
        break
      case 'RIGHT':
        qsPanelLeft = screen.availWidth - qsPanelWidth - 30
        qsPanelTop = (screen.availHeight - qssaHeight) / 2
        break
      case 'BOTTOM':
        qsPanelLeft = (screen.availWidth - qsPanelWidth) / 2
        qsPanelTop = screen.availHeight - qsPanelHeight - 10
        break
      case 'LEFT':
        qsPanelLeft = 10
        qsPanelTop = (screen.availHeight - qssaHeight) / 2
        break
      case 'TOP_LEFT':
        qsPanelLeft = 10
        qsPanelTop = 30
        break
      case 'TOP_RIGHT':
        qsPanelLeft = screen.availWidth - qsPanelWidth - 30
        qsPanelTop = 30
        break
      case 'BOTTOM_LEFT':
        qsPanelLeft = 10
        qsPanelTop = screen.availHeight - qsPanelHeight - 10
        break
      case 'BOTTOM_RIGHT':
        qsPanelLeft = screen.availWidth - qsPanelWidth - 30
        qsPanelTop = screen.availHeight - qsPanelHeight - 10
        break
    }

    // coords must be integer
    // plus offset of other screen
    return {
      top: Math.round(qsPanelTop + (screen.availTop || 0)),
      left: Math.round(qsPanelLeft + (screen.availLeft || 0)),
      width: Math.round(qsPanelWidth),
      height: Math.round(qsPanelHeight)
    }
  }

  /** get saved panel rect */
  async getStorageRect(): Promise<WinRect | null> {
    const { qssaRect } = await storage.local.get<{ qssaRect: WinRect }>(
      'qssaRect'
    )
    if (!qssaRect) return null
    return {
      ...qssaRect,
      top: (await this.correctTop(qssaRect.top)) || 0
    }
  }

  async getSidebarRect(side: 'left' | 'right'): Promise<WinRect> {
    const panelWidth =
      (this.snapshot && this.snapshot.width) || getAppConfig().panelWidth
    const mainWin = this.mainWindowsManager.snapshot
    if (
      mainWin &&
      mainWin.state === 'normal' &&
      mainWin.top != null &&
      mainWin.left != null &&
      mainWin.width != null &&
      mainWin.height != null
    ) {
      // coords must be integer
      return {
        top: Math.round(
          (await this.mainWindowsManager.correctTop(mainWin.top)) || 0
        ),
        left: Math.round(
          side === 'right'
            ? Math.max(mainWin.width - panelWidth, panelWidth)
            : mainWin.left
        ),
        width: Math.round(panelWidth),
        height: Math.round(mainWin.height)
      }
    }

    const screen = await getScreenInfo()
    return {
      top: 0,
      left: Math.round(side === 'right' ? screen.availWidth - panelWidth : 0),
      width: Math.round(panelWidth),
      height: Math.round(screen.availHeight)
    }
  }
}
