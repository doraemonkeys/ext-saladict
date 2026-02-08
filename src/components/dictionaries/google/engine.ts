import { SearchFunction, GetSrcPageFunction } from '../helpers'
import memoizeOne from 'memoize-one'
import { Google } from '@opentranslate/google'
import {
  MachineTranslateResult,
  MachineTranslatePayload,
  getMTArgs,
  machineResult
} from '@/components/MachineTrans/engine'
import { GoogleLanguage } from './config'
import { Language } from '@opentranslate/languages'

// MV3: The @opentranslate/google library depends on google-translate-open-api
// which bundles axios-https-proxy-fix — a separate axios package that lacks our
// fetch adapter.  Webpack bundles it as a distinct module, so even passing the
// main axios instance doesn't help.  We keep the Google translator only for
// language list / getMTArgs and implement the actual translate call via fetch().
export const getTranslator = memoizeOne(
  () => new Google({ env: 'ext' })
)

export const getSrcPage: GetSrcPageFunction = (text, config, profile) => {
  const domain = 'com'
  const lang =
    profile.dicts.all.google.options.tl === 'default'
      ? config.langCode
      : profile.dicts.all.google.options.tl

  return `https://translate.google.${domain}/#auto/${lang}/${text}`
}

export type GoogleResult = MachineTranslateResult<'google'>

/**
 * MV3-safe Google Translate via the free googleapis endpoint using fetch().
 */
async function googleTranslateViaFetch(
  text: string,
  sl: string,
  tl: string
): Promise<{ from: string; transText: string }> {
  const params = new URLSearchParams({
    client: 'gtx',
    dt: 't',
    sl,
    tl,
    q: text
  })
  const url = `https://translate.googleapis.com/translate_a/single?${params}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Google Translate HTTP ${res.status}`)
  }
  const json = await res.json()
  if (!json[0] || json[0].length <= 0) {
    throw new Error('API_SERVER_ERROR')
  }
  const transText = json[0]
    .map((item: any) => item[0])
    .filter(Boolean)
    .join(' ')
  const detectedLang: string = json[2] || sl
  return { from: detectedLang, transText }
}

export const search: SearchFunction<
  GoogleResult,
  MachineTranslatePayload<GoogleLanguage>
> = async (rawText, config, profile, payload) => {
  const translator = getTranslator()

  const { sl, tl, text } = await getMTArgs(
    translator,
    rawText,
    profile.dicts.all.google,
    config,
    payload
  )

  const { from, transText } = await googleTranslateViaFetch(text, sl, tl)

  return machineResult(
    {
      result: {
        id: 'google',
        sl: from,
        tl,
        slInitial: profile.dicts.all.google.options.slInitial,
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
    translator.getSupportLanguages()
  )
}

export async function getTTS(text: string, lang: Language): Promise<string> {
  return ''
}
