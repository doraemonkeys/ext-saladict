import { SearchFunction, GetSrcPageFunction } from '../helpers'
import {
  MachineTranslateResult,
  MachineTranslatePayload,
  getMTArgs,
  machineResult
} from '@/components/MachineTrans/engine'
import { BingtransLanguage } from './config'
import { Language } from '@opentranslate/languages'
import { isContainJapanese, isContainKorean } from '@/_helpers/lang-check'

// ---------------------------------------------------------------------------
// Microsoft / Bing Translator via the free Edge auth endpoint (no API key).
//
// Flow:
// 1. GET  https://edge.microsoft.com/translate/auth  → JWT token (≈10 min)
// 2. POST https://api-edge.cognitive.microsofttranslator.com/translate
//         ?api-version=3.0&to=<tl>[&from=<sl>]
//    Body: [{"Text":"..."}]
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES: readonly Language[] = [
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'ru',
  'nl',
  'pt'
]

// ---- language code mapping ------------------------------------------------

/** Map saladict / @opentranslate language codes → Microsoft Translator codes */
const LANG_TO_MS: Record<string, string> = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant'
  // all other codes are identical
}

/** Map Microsoft Translator codes → @opentranslate codes */
const MS_TO_LANG: Record<string, Language> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW'
}

function toMSLang(lang: string): string {
  return LANG_TO_MS[lang] || lang
}

function fromMSLang(msLang: string): Language {
  return (MS_TO_LANG[msLang] || msLang) as Language
}

// ---- auth token -----------------------------------------------------------

let cachedToken: { token: string; expiry: number } | null = null

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiry) {
    return cachedToken.token
  }
  const res = await fetch('https://edge.microsoft.com/translate/auth')
  if (!res.ok) {
    throw new Error(`Bing Translate auth HTTP ${res.status}`)
  }
  const token = await res.text()
  // Token is valid for ~10 min; cache for 8 min to be safe.
  cachedToken = { token, expiry: Date.now() + 8 * 60 * 1000 }
  return token
}

// ---- minimal translator-like object for getMTArgs -------------------------

const msTranslator = {
  async detect(text: string): Promise<Language> {
    const token = await getAuthToken()
    const res = await fetch(
      'https://api-edge.cognitive.microsofttranslator.com/detect?api-version=3.0',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ Text: text.slice(0, 1000) }])
      }
    )
    if (!res.ok) {
      // Fallback: basic heuristic
      if (isContainJapanese(text)) return 'ja'
      if (isContainKorean(text)) return 'ko'
      return 'en'
    }
    const data: Array<{ language: string }> = await res.json()
    return fromMSLang(data[0]?.language || 'en')
  },

  getSupportLanguages(): ReadonlyArray<string> {
    return SUPPORTED_LANGUAGES
  }
}

// ---- translation ----------------------------------------------------------

async function bingTranslateViaFetch(
  text: string,
  sl: string,
  tl: string
): Promise<{ from: string; transText: string }> {
  const token = await getAuthToken()
  const msTl = toMSLang(tl)

  const params = new URLSearchParams({
    'api-version': '3.0',
    to: msTl
  })

  // Only set `from` when we know the source language; omitting enables auto-detect.
  if (sl && sl !== 'auto') {
    params.set('from', toMSLang(sl))
  }

  const res = await fetch(
    `https://api-edge.cognitive.microsofttranslator.com/translate?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ Text: text }])
    }
  )

  if (!res.ok) {
    throw new Error(`Bing Translate HTTP ${res.status}`)
  }

  const data: Array<{
    detectedLanguage?: { language: string }
    translations: Array<{ text: string; to: string }>
  }> = await res.json()

  const entry = data[0]
  const detectedLang = entry?.detectedLanguage?.language || sl
  const transText = entry?.translations?.[0]?.text || ''

  return { from: fromMSLang(detectedLang) as string, transText }
}

// ---- public API -----------------------------------------------------------

export const getSrcPage: GetSrcPageFunction = (text, config, profile) => {
  const lang =
    profile.dicts.all.bingtrans.options.tl === 'default'
      ? config.langCode === 'zh-CN'
        ? 'zh-Hans'
        : config.langCode === 'zh-TW'
        ? 'zh-Hant'
        : 'en'
      : toMSLang(profile.dicts.all.bingtrans.options.tl)

  return `https://www.bing.com/translator/?from=auto&to=${lang}&text=${encodeURIComponent(text)}`
}

export type BingtransResult = MachineTranslateResult<'bingtrans'>

export const search: SearchFunction<
  BingtransResult,
  MachineTranslatePayload<BingtransLanguage>
> = async (rawText, config, profile, payload) => {
  const { sl, tl, text } = await getMTArgs(
    msTranslator as any,
    rawText,
    profile.dicts.all.bingtrans,
    config,
    payload
  )

  const { from, transText } = await bingTranslateViaFetch(text, sl, tl)

  return machineResult(
    {
      result: {
        id: 'bingtrans',
        sl: from,
        tl,
        slInitial: profile.dicts.all.bingtrans.options.slInitial,
        searchText: {
          paragraphs: text.split(/\n+/),
          tts: ''
        },
        trans: {
          paragraphs: transText.split(/(\n ?)+/),
          tts: ''
        }
      }
    },
    msTranslator.getSupportLanguages()
  )
}
