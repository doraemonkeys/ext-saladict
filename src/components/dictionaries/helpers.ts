// MV3: DOMPurify cannot run in a Service Worker (no DOM).
// Use lightweight manual sanitization instead.
// NOTE: React hooks moved to helpers-react.ts to avoid pulling React into
// the Service Worker (which has no `window`).
import AxiosMockAdapter from 'axios-mock-adapter'
import { DictID, AppConfig } from '@/app-config'
import { Profile } from '@/app-config/profiles'
import { Word } from '@/_helpers/record-manager'
import { isTagName } from '@/_helpers/dom'
import { isInternalPage } from '@/_helpers/saladict'

/** Fetch and parse dictionary search result */
export interface SearchFunction<Result, Payload = {}> {
  (
    text: string,
    config: AppConfig,
    profile: Profile,
    payload: Readonly<Payload & { isPDF: boolean }>
  ): Promise<DictSearchResult<Result>>
}

export interface DictSearchResult<Result> {
  /** search result */
  result: Result
  /** auto play sound */
  audio?: {
    uk?: string
    us?: string
    py?: string
  }
  /** generate menus on dict titlebars */
  catalog?: Array<
    | {
        // <button>
        key: string
        value: string
        label: string
        options?: undefined
      }
    | {
        // <select>
        key: string
        value: string
        options: Array<{
          value: string
          label: string
        }>
        title?: string
      }
  >
}

/** Return a dictionary source page url for the dictionary header */
export interface GetSrcPageFunction {
  (text: string, config: AppConfig, profile: Profile): string | Promise<string>
}

/**
 * For testing and storybook.
 *
 * Mock all the requests and returns all searchable texts.
 */
export interface MockRequest {
  (mock: AxiosMockAdapter): void
}

export type HTMLString = string

export interface ViewPorps<T> {
  result: T
  searchText: <P = { [index: string]: any }>(arg?: {
    id?: DictID
    word?: Word
    payload?: P
  }) => any
  /** Emit catalog key and value when selected */
  catalogSelect$: Observable<{ key: string; value: string }>
}

export type SearchErrorType = 'NO_RESULT' | 'NETWORK_ERROR'

export function handleNoResult<T = any>(): Promise<T> {
  return Promise.reject(new Error('NO_RESULT'))
}

export function handleNetWorkError(): Promise<never> {
  return Promise.reject(new Error('NETWORK_ERROR'))
}

/**
 * Get chs-chz transform function on-demand.
 * The dict object is huge.
 * @param langCode
 */
export async function getChsToChz(): Promise<(text: string) => string>
export async function getChsToChz(
  langCode: string
): Promise<null | ((text: string) => string)>
export async function getChsToChz(
  langCode?: string
): Promise<null | ((text: string) => string)> {
  return langCode == null || /zh-TW|zh-HK/i.test(langCode)
    ? (await import('@/_helpers/chs-to-chz')).chsToChz
    : null
}

/**
 * Get the textContent of a node or its child.
 */
export function getText(
  parent: ParentNode | null,
  selector?: string,
  transform?: null | ((text: string) => string)
): string
export function getText(
  parent: ParentNode | null,
  transform?: null | ((text: string) => string),
  selector?: string
): string
export function getText(
  parent: ParentNode | null,
  ...args:
    | [string?, (null | ((text: string) => string))?]
    | [(null | ((text: string) => string))?, string?]
): string {
  if (!parent) {
    return ''
  }

  let selector = ''
  let transform: null | ((text: string) => string) = null
  for (let i = args.length - 1; i >= 0; i--) {
    if (typeof args[i] === 'string') {
      selector = args[i] as string
    } else if (typeof args[i] === 'function') {
      transform = args[i] as (text: string) => string
    }
  }

  const child = selector
    ? parent.querySelector(selector)
    : (parent as HTMLElement)
  if (!child) {
    return ''
  }

  const textContent = child.textContent || ''
  return transform ? transform(textContent) : textContent
}

/** Lightweight sanitization config (replaces DOMPurify.Config for MV3) */
export interface SanitizeConfig {
  FORBID_TAGS?: string[]
  FORBID_ATTR?: string[]
}

export interface GetHTMLConfig {
  /** innerHTML or outerHTML */
  mode?: 'innerHTML' | 'outerHTML'
  /** Select child node */
  selector?: string
  /** transform text */
  transform?: null | ((text: string) => string)
  /** Give url and src a host */
  host?: string
  /** Sanitize config */
  config?: SanitizeConfig
}

const defaultSanitizeConfig: SanitizeConfig = {
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style']
}

/**
 * Strip dangerous HTML tags (script, etc.) from a string.
 * Lightweight replacement for DOMPurify.sanitize() in Service Worker.
 */
export function stripScriptTags(html: string): string {
  return html
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<\/script>/gi, '')
}

export function getHTML(
  parent: ParentNode,
  {
    mode = 'innerHTML',
    selector,
    transform,
    host,
    config = defaultSanitizeConfig
  }: GetHTMLConfig = {}
): string {
  const node = selector
    ? parent.querySelector<HTMLElement>(selector)
    : (parent as HTMLElement)
  if (!node) {
    return ''
  }

  if (host) {
    const fillLink = (el: HTMLElement) => {
      if (el.getAttribute('href')) {
        el.setAttribute('href', getFullLink(host!, el, 'href'))
      }
      if (el.getAttribute('src')) {
        el.setAttribute('src', getFullLink(host!, el, 'src'))
      }
      if (isInternalPage() && el.getAttribute('srcset')) {
        el.setAttribute(
          'srcset',
          el
            .getAttribute('srcset')!
            .replace(/(,| |^)\/\//g, (_, head) => head + 'https://')
        )
      }
    }

    if (isTagName(node, 'a') || isTagName(node, 'img')) {
      fillLink(node)
    }
    node.querySelectorAll('a').forEach(fillLink)
    node.querySelectorAll('img').forEach(fillLink)
  }

  // MV3: Manual sanitization instead of DOMPurify (no DOM in Service Worker)
  const forbidTags = config.FORBID_TAGS || []
  const forbidAttrs = config.FORBID_ATTR || []

  for (const tag of forbidTags) {
    node.querySelectorAll(tag).forEach((el: any) => {
      if (el.remove) el.remove()
      else if (el.parentNode) el.parentNode.removeChild(el)
    })
  }

  for (const attr of forbidAttrs) {
    node.querySelectorAll('[' + attr + ']').forEach((el: any) => {
      el.removeAttribute(attr)
    })
  }

  const content = node[mode] || ''

  return transform ? transform(content) : content
}

export function getInnerHTML(
  host: string,
  parent: ParentNode,
  selectorOrConfig: string | Omit<GetHTMLConfig, 'mode' | 'host'> = {}
) {
  return getHTML(
    parent,
    typeof selectorOrConfig === 'string'
      ? { selector: selectorOrConfig, host, mode: 'innerHTML' }
      : { ...selectorOrConfig, host, mode: 'innerHTML' }
  )
}

export function getOuterHTML(
  host: string,
  parent: ParentNode,
  selectorOrConfig: string | Omit<GetHTMLConfig, 'mode' | 'host'> = {}
) {
  return getHTML(
    parent,
    typeof selectorOrConfig === 'string'
      ? { selector: selectorOrConfig, host, mode: 'outerHTML' }
      : { ...selectorOrConfig, host, mode: 'outerHTML' }
  )
}

/**
 * Remove a child node from a parent node
 */
export function removeChild(parent: ParentNode, selector: string) {
  const child = parent.querySelector(selector)
  if (child) {
    child.remove()
  }
}

/**
 * Remove all the matching child nodes from a parent node
 */
export function removeChildren(parent: ParentNode, selector: string) {
  parent.querySelectorAll(selector).forEach(el => el.remove())
}

/**
 * HEX string to normal string
 */
export function decodeHEX(text: string): string {
  return text.replace(/\\x([0-9A-Fa-f]{2})/g, (m, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  )
}

/**
 * Will jump to the website instead of searching
 * when clicking on the dict panel
 */
export function externalLink($a: HTMLElement) {
  $a.setAttribute('target', '_blank')
  $a.setAttribute('rel', 'nofollow noopener noreferrer')
}

export function getFullLink(host: string, el: Element, attr: string): string {
  if (host.endsWith('/')) {
    host = host.slice(0, -1)
  }

  const protocol = host.startsWith('https') ? 'https:' : 'http:'

  const link = el.getAttribute(attr)
  if (!link) {
    return ''
  }

  if (/^[a-zA-Z0-9]+:/.test(link)) {
    return link
  }

  if (link.startsWith('//')) {
    return protocol + link
  }

  if (/^.?\/+/.test(link)) {
    return host + '/' + link.replace(/^.?\/+/, '')
  }

  return host + '/' + link
}

