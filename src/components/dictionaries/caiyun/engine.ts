import axios from 'axios'
import { SearchFunction, GetSrcPageFunction } from '../helpers'
import memoizeOne from 'memoize-one'
import { Caiyun } from '@opentranslate/caiyun'
import { TranslateResult } from '@opentranslate/translator'
import {
  MachineTranslateResult,
  MachineTranslatePayload,
  getMTArgs,
  machineResult
} from '@/components/MachineTrans/engine'
import { getTranslator as getBaiduTranslator } from '../baidu/engine'
import { CaiyunLanguage } from './config'

export const getTranslator = memoizeOne(
  () =>
    new Caiyun({
      env: 'ext',
      // MV3: pass the main bundle's axios (with fetch adapter installed)
      // so the translator doesn't use its own copy without the adapter
      axios: axios as any,
      config: process.env.CAIYUN_TOKEN
        ? {
            token: process.env.CAIYUN_TOKEN
          }
        : undefined
    })
)

export const getSrcPage: GetSrcPageFunction = () => {
  return 'https://fanyi.caiyunapp.com/'
}

export type CaiyunResult = MachineTranslateResult<'caiyun'>

export const search: SearchFunction<
  CaiyunResult,
  MachineTranslatePayload<CaiyunLanguage>
> = async (rawText, config, profile, payload) => {
  const translator = getTranslator()
  const langcodes = translator.getSupportLanguages()

  let { sl, tl, text } = await getMTArgs(
    translator,
    rawText,
    profile.dicts.all.caiyun,
    config,
    payload
  )

  const baiduTranslator = getBaiduTranslator()

  let baiduResult: TranslateResult | undefined

  // Caiyun's lang detection is broken, use Baidu for detection.
  // Only call Baidu API when credentials are configured to avoid UNAUTHORIZED USER errors.
  const baiduAppid = config.dictAuth.baidu.appid
  const baiduKey = config.dictAuth.baidu.key
  if (baiduAppid && baiduKey) {
    try {
      baiduResult = await baiduTranslator.translate(text, sl, tl, { appid: baiduAppid, key: baiduKey })
      if (langcodes.includes(baiduResult.from)) {
        sl = baiduResult.from
      }
    } catch (e) {
      console.warn('Caiyun: Baidu language detection failed, using default', e)
    }
  }

  const caiYunToken = config.dictAuth.caiyun.token
  const caiYunConfig = caiYunToken ? { token: caiYunToken } : undefined

  const result = await translator.translate(text, sl, tl, caiYunConfig)
  // TTS is optional — don't let TTS failure kill a successful translation
  try {
    result.origin.tts = await baiduTranslator.textToSpeech(
      result.origin.paragraphs.join('\n'),
      result.from
    )
    result.trans.tts = await baiduTranslator.textToSpeech(
      result.trans.paragraphs.join('\n'),
      result.to
    )
  } catch {
    /* TTS is optional — failure is non-fatal */
  }
  return machineResult(
    {
      result: {
        id: 'caiyun',
        sl: result.from,
        tl: result.to,
        slInitial: profile.dicts.all.caiyun.options.slInitial,
        searchText: result.origin,
        trans: result.trans
      },
      audio: {
        py: result.trans.tts,
        us: result.trans.tts
      }
    },
    langcodes
  )
}
