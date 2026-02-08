/**
 * i18n module with React components.
 *
 * Re-exports everything from `i18n-base.ts` (Service Worker safe) plus
 * React-dependent components (I18nContext, I18nContextProvider, useTranslate, Trans).
 *
 * Frontend code should import from this file.
 * Background / Service Worker code should import from `i18n-base.ts` instead.
 */
import React, {
  useState,
  useLayoutEffect,
  FC,
  useContext,
  useRef,
  Fragment,
  PropsWithChildren
} from 'react'
import i18n, { TFunction } from 'i18next'
import zip from 'lodash/zip'

// Re-export everything from the base module so existing imports keep working
export * from './i18n-base'
export { i18nLoader } from './i18n-base'

import { Namespace } from './i18n-base'

const defaultT: i18n.TFunction = () => ''

export const I18nContext = React.createContext<string | undefined>(undefined)
if (process.env.DEBUG) {
  I18nContext.displayName = 'I18nContext'
}

export const I18nContextProvider: FC = ({ children }) => {
  const [lang, setLang] = useState<string | undefined>(undefined)

  useLayoutEffect(() => {
    let isActive = true

    const { i18nLoader } = require('./i18n-base')

    const setLangCallback = () => {
      if (isActive) {
        setLang(i18n.language)
      }
    }

    if (i18n.language) {
      // i18n already initialized (e.g. singleton reuse, HMR remount)
      setLang(i18n.language)
      i18n.on('languageChanged', setLangCallback)
    } else {
      i18nLoader().then(() => {
        if (isActive) {
          setLang(i18n.language)
        }
        i18n.on('languageChanged', setLangCallback)
      })
    }

    return () => {
      isActive = false
      i18n.off('languageChanged', setLangCallback)
    }
  }, [])

  return React.createElement(I18nContext.Provider, { value: lang }, children)
}

export interface UseTranslateResult {
  /**
   * fixedT with the first namespace as default.
   * It is a wrapper of the original fixedT, which
   * keeps the same reference even after namespaces are loaded
   */
  t: i18n.TFunction
  i18n: i18n.i18n
  /**
   * Are namespaces loaded?
   * false not ready
   * otherwise it is a non-zero positive number
   * that changes everytime when new namespaces are loaded.
   */
  ready: false | number
}

/**
 * Tailored for this project.
 * The official `useTranslation` is too heavy.
 * @param namespaces will not monitor namespace changes.
 */
export function useTranslate(
  namespaces?: Namespace | Namespace[]
): UseTranslateResult {
  const ticketRef = useRef(0)
  const innerTRef = useRef<TFunction>(defaultT)
  // keep the exposed t function always the same
  const tRef = useRef<TFunction>((...args: Parameters<TFunction>) =>
    innerTRef.current(...args)
  )
  const lang = useContext(I18nContext)

  const genResult = (t: TFunction | null, ready: boolean) => {
    if (t) {
      innerTRef.current = t
    }
    if (ready) {
      ticketRef.current = (ticketRef.current + 1) % 100000
    }
    const result: UseTranslateResult = {
      t: tRef.current,
      i18n,
      ready: ready ? ticketRef.current : false
    }
    return result
  }

  const [result, setResult] = useState<UseTranslateResult>(() => {
    if (!lang) {
      return genResult(defaultT, false)
    }

    if (!namespaces) {
      return genResult(i18n.t, true)
    }

    if (
      Array.isArray(namespaces)
        ? namespaces.every(ns => i18n.hasResourceBundle(lang, ns))
        : i18n.hasResourceBundle(lang, namespaces)
    ) {
      return genResult(i18n.getFixedT(lang, namespaces), true)
    }

    return genResult(defaultT, false)
  })

  useLayoutEffect(() => {
    let isEffectRunning = true

    if (lang) {
      if (namespaces) {
        if (
          Array.isArray(namespaces)
            ? namespaces.every(ns => i18n.hasResourceBundle(lang, ns))
            : i18n.hasResourceBundle(lang, namespaces)
        ) {
          setResult(genResult(i18n.getFixedT(lang, namespaces), true))
        } else {
          // keep the old t while marking not ready
          setResult(genResult(null, false))

          i18n.loadNamespaces(namespaces).then(() => {
            if (isEffectRunning) {
              setResult(genResult(i18n.getFixedT(lang, namespaces), true))
            }
          })
        }
      } else {
        setResult(genResult(i18n.t, true))
      }
    }

    return () => {
      isEffectRunning = false
    }
  }, [lang])

  return result
}

/**
 * <Trans message="a{b}c{d}e">
 *   <h1>b</h1>
 *   <p>d</p>
 * </Trans>
 *  ↓
 * [
 *   "a",
 *   <h1>b</h1>,
 *   "c",
 *   <p>d</p>,
 *   "e"
 * ]
 */
export const Trans = React.memo<PropsWithChildren<{ message?: string }>>(
  ({ message, children }) => {
    if (!message) return null

    return React.createElement(
      Fragment,
      null,
      zip(
        message.split(/{[^}]*?}/),
        Array.isArray(children) ? children : [children]
      )
    )
  }
)
