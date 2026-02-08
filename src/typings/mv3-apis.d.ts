/**
 * Supplementary type declarations for Chrome MV3 APIs that
 * @types/firefox-webext-browser may not fully cover.
 *
 * These declarations are intentionally minimal — just enough to unblock
 * the MV3 migration without conflicting with upstream types.
 */

declare namespace chrome {
  // ──────────────────────────────────────────────
  // chrome.scripting
  // ──────────────────────────────────────────────
  namespace scripting {
    interface InjectionTarget {
      tabId: number
      allFrames?: boolean
      frameIds?: number[]
      documentIds?: string[]
    }

    interface CSSInjection {
      target: InjectionTarget
      files?: string[]
      css?: string
      origin?: 'USER' | 'AUTHOR'
    }

    interface ScriptInjection {
      target: InjectionTarget
      files?: string[]
      func?: (...args: any[]) => any
      args?: any[]
      world?: 'ISOLATED' | 'MAIN'
      injectImmediately?: boolean
    }

    interface InjectionResult {
      documentId: string
      frameId: number
      result: any
    }

    function executeScript(
      injection: ScriptInjection
    ): Promise<InjectionResult[]>

    function insertCSS(injection: CSSInjection): Promise<void>

    function removeCSS(injection: CSSInjection): Promise<void>
  }

  // ──────────────────────────────────────────────
  // chrome.offscreen
  // ──────────────────────────────────────────────
  namespace offscreen {
    type Reason =
      | 'TESTING'
      | 'AUDIO_PLAYBACK'
      | 'CLIPBOARD'
      | 'DOM_PARSER'
      | 'DOM_SCRAPING'
      | 'BLOBS'
      | 'IFRAME_SCRIPTING'
      | 'WORKERS'
      | 'BATTERY_STATUS'
      | 'MATCH_MEDIA'
      | 'GEOLOCATION'
      | 'USER_MEDIA'
      | 'DISPLAY_MEDIA'
      | 'WEB_RTC'
      | 'LOCAL_STORAGE'

    // Also expose as a namespace of constants for enum-style usage
    const Reason: {
      TESTING: 'TESTING'
      AUDIO_PLAYBACK: 'AUDIO_PLAYBACK'
      CLIPBOARD: 'CLIPBOARD'
      DOM_PARSER: 'DOM_PARSER'
      DOM_SCRAPING: 'DOM_SCRAPING'
      BLOBS: 'BLOBS'
      IFRAME_SCRIPTING: 'IFRAME_SCRIPTING'
      WORKERS: 'WORKERS'
      BATTERY_STATUS: 'BATTERY_STATUS'
      MATCH_MEDIA: 'MATCH_MEDIA'
      GEOLOCATION: 'GEOLOCATION'
      USER_MEDIA: 'USER_MEDIA'
      DISPLAY_MEDIA: 'DISPLAY_MEDIA'
      WEB_RTC: 'WEB_RTC'
      LOCAL_STORAGE: 'LOCAL_STORAGE'
    }

    interface CreateParameters {
      url: string
      reasons: Reason[]
      justification: string
    }

    function createDocument(parameters: CreateParameters): Promise<void>
    function closeDocument(): Promise<void>
    function hasDocument(): Promise<boolean>
  }

  // ──────────────────────────────────────────────
  // chrome.declarativeNetRequest
  // ──────────────────────────────────────────────
  namespace declarativeNetRequest {
    type ResourceType =
      | 'main_frame'
      | 'sub_frame'
      | 'stylesheet'
      | 'script'
      | 'image'
      | 'font'
      | 'object'
      | 'xmlhttprequest'
      | 'ping'
      | 'csp_report'
      | 'media'
      | 'websocket'
      | 'webtransport'
      | 'webbundle'
      | 'other'

    type HeaderOperation = 'append' | 'set' | 'remove'

    interface ModifyHeaderInfo {
      header: string
      operation: HeaderOperation
      value?: string
    }

    interface RuleCondition {
      urlFilter?: string
      regexFilter?: string
      resourceTypes?: ResourceType[]
      excludedResourceTypes?: ResourceType[]
      domains?: string[]
      excludedDomains?: string[]
      initiatorDomains?: string[]
      excludedInitiatorDomains?: string[]
      requestMethods?: string[]
      tabIds?: number[]
    }

    interface RuleAction {
      type:
        | 'block'
        | 'redirect'
        | 'allow'
        | 'upgradeScheme'
        | 'modifyHeaders'
        | 'allowAllRequests'
      redirect?: {
        url?: string
        regexSubstitution?: string
        extensionPath?: string
        transform?: any
      }
      requestHeaders?: ModifyHeaderInfo[]
      responseHeaders?: ModifyHeaderInfo[]
    }

    interface Rule {
      id: number
      priority?: number
      action: RuleAction
      condition: RuleCondition
    }

    interface UpdateRuleOptions {
      removeRuleIds?: number[]
      addRules?: Rule[]
    }

    function updateDynamicRules(options: UpdateRuleOptions): Promise<void>
    function updateSessionRules(options: UpdateRuleOptions): Promise<void>
    function getDynamicRules(): Promise<Rule[]>
    function getSessionRules(): Promise<Rule[]>
  }

  // ──────────────────────────────────────────────
  // chrome.action  (MV3 replacement for browserAction)
  // ──────────────────────────────────────────────
  namespace action {
    interface TabIconDetails {
      tabId?: number
      path?: string | Record<number, string>
      imageData?: ImageData | Record<number, ImageData>
    }

    interface TitleDetails {
      title: string
      tabId?: number
    }

    interface BadgeTextDetails {
      text: string
      tabId?: number
    }

    interface BadgeColorDetails {
      color: string | [number, number, number, number]
      tabId?: number
    }

    interface PopupDetails {
      popup: string
      tabId?: number
    }

    function setTitle(details: TitleDetails): Promise<void>
    function getTitle(details: { tabId?: number }): Promise<string>
    function setIcon(details: TabIconDetails): Promise<void>
    function setBadgeText(details: BadgeTextDetails): Promise<void>
    function getBadgeText(details: { tabId?: number }): Promise<string>
    function setBadgeBackgroundColor(details: BadgeColorDetails): Promise<void>
    function getBadgeBackgroundColor(details: {
      tabId?: number
    }): Promise<[number, number, number, number]>
    function setPopup(details: PopupDetails): Promise<void>
    function getPopup(details: { tabId?: number }): Promise<string>
    function enable(tabId?: number): Promise<void>
    function disable(tabId?: number): Promise<void>
    function isEnabled(details: { tabId?: number }): Promise<boolean>

    const onClicked: {
      addListener(callback: (tab: chrome.tabs.Tab) => void): void
      removeListener(callback: (tab: chrome.tabs.Tab) => void): void
      hasListener(callback: (tab: chrome.tabs.Tab) => void): boolean
    }
  }

  // ──────────────────────────────────────────────
  // chrome.runtime — MV3 additions
  // ──────────────────────────────────────────────
  namespace runtime {
    type ContextType =
      | 'TAB'
      | 'POPUP'
      | 'BACKGROUND'
      | 'OFFSCREEN_DOCUMENT'
      | 'SIDE_PANEL'

    // Also expose as a namespace of constants for enum-style usage
    const ContextType: {
      TAB: 'TAB'
      POPUP: 'POPUP'
      BACKGROUND: 'BACKGROUND'
      OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT'
      SIDE_PANEL: 'SIDE_PANEL'
    }

    interface ContextFilter {
      contextTypes?: ContextType[]
      documentIds?: string[]
      documentOrigins?: string[]
      documentUrls?: string[]
      frameIds?: number[]
      incognito?: boolean
      tabIds?: number[]
      windowIds?: number[]
    }

    interface ExtensionContext {
      contextType: ContextType
      documentId?: string
      documentOrigin?: string
      documentUrl?: string
      frameId: number
      incognito: boolean
      tabId: number
      windowId: number
    }

    function getContexts(filter: ContextFilter): Promise<ExtensionContext[]>
  }

  // ──────────────────────────────────────────────
  // chrome.system.display
  // ──────────────────────────────────────────────
  namespace system.display {
    interface Bounds {
      left: number
      top: number
      width: number
      height: number
    }

    interface Insets {
      left: number
      top: number
      right: number
      bottom: number
    }

    interface DisplayInfo {
      id: string
      name: string
      isPrimary: boolean
      isInternal: boolean
      isEnabled: boolean
      isUnified: boolean
      bounds: Bounds
      workArea: Bounds
      overscan: Insets
      rotation: number
      mirroringSourceId: string
      mirroringDestinationIds: string[]
      dpiX: number
      dpiY: number
    }

    function getInfo(): Promise<DisplayInfo[]>
    function getInfo(flags: { singleUnified?: boolean }): Promise<DisplayInfo[]>
  }
}
