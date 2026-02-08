/**
 * Non-React i18n utilities.
 *
 * This module is safe to import from the Service Worker (background script)
 * because it does NOT depend on React or any DOM APIs.
 *
 * React-dependent i18n components (I18nContext, useTranslate, Trans, etc.)
 * remain in `i18n.ts` which re-exports everything from this file.
 */
import mapValues from 'lodash/mapValues'
import i18n from 'i18next'
import { getConfig, addConfigListener } from '@/_helpers/config-manager'

export type LangCode = 'zh-CN' | 'zh-TW' | 'en'
export type Namespace =
  | 'common'
  | 'content'
  | 'langcode'
  | 'menus'
  | 'options'
  | 'popup'
  | 'wordpage'
  | 'dicts'
  | 'sync'

export interface RawLocale {
  'zh-CN': string
  'zh-TW': string
  en: string
}

export interface RawLocales {
  [message: string]: RawLocale
}

export interface RawDictLocales {
  name: RawLocale
  options?: RawLocales
  helps?: RawLocales
}

export interface DictLocales {
  name: string
  options?: {
    [message: string]: any
  }
  helps?: {
    [message: string]: any
  }
}

export async function i18nLoader(): Promise<i18n.i18n> {
  if (i18n.language) {
    // singleton
    return i18n
  }

  const { langCode } = await getConfig()

  await i18n
    .use({
      type: 'backend',
      init: () => {},
      create: () => {},
      read: async (lang: LangCode, ns: Namespace, cb: Function) => {
        try {
          if (ns === 'dicts') {
            const dictLocals = extractDictLocales(lang)
            cb(null, dictLocals)
            return dictLocals
          }

          if (ns === 'sync') {
            const syncLocales = extractSyncServiceLocales(lang)
            cb(null, syncLocales)
            return syncLocales
          }

          const { locale } = await import(
            /* webpackInclude: /\.ts$/ */
            /* webpackMode: "eager" */
            `@/_locales/${lang}/${ns}.ts`
          )
          cb(null, locale)
          return locale
        } catch (err) {
          cb(err)
        }
      }
    })
    .init({
      lng: langCode,
      fallbackLng: false,
      whitelist: ['en', 'zh-CN', 'zh-TW'],

      debug: process.env.NODE_ENV === 'development',
      saveMissing: false,
      load: 'currentOnly',

      ns: 'common',
      defaultNS: 'common',

      interpolation: {
        escapeValue: false // not needed for react as it escapes by default
      }
    })

  addConfigListener(({ newConfig }) => {
    if (i18n.language !== newConfig.langCode) {
      i18n.changeLanguage(newConfig.langCode)
    }
  })

  return i18n
}

function extractDictLocales(lang: LangCode) {
  const req = require.context(
    '@/components/dictionaries',
    true,
    /_locales\.(json|ts)$/
  )
  return req.keys().reduce<{ [id: string]: DictLocales }>((o, filename) => {
    const localeModule = req(filename)
    const json: RawDictLocales = localeModule.locales || localeModule
    const dictId = /([^/]+)\/_locales\.(json|ts)$/.exec(filename)![1]
    o[dictId] = {
      name: json.name[lang]
    }
    if (json.options) {
      o[dictId].options = mapValues(json.options, rawLocale => rawLocale[lang])
    }
    if (json.helps) {
      o[dictId].helps = mapValues(json.helps, rawLocale => rawLocale[lang])
    }
    return o
  }, {})
}

function extractSyncServiceLocales(lang: LangCode) {
  const req = require.context(
    '@/background/sync-manager/services',
    true,
    /_locales\/.+\.ts$/
  )
  return req.keys().reduce<{ [id: string]: DictLocales }>((o, filename) => {
    const idMatch = new RegExp(`/([^/]+)/_locales/${lang}\\.ts$`).exec(filename)
    if (idMatch) {
      const localeModule = req(filename)
      o[idMatch[1]] = localeModule.locale || localeModule
    }
    return o
  }, {})
}
