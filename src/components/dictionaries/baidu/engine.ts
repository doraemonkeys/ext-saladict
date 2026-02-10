import axios from 'axios'
import { SearchFunction, GetSrcPageFunction } from '../helpers'
import memoizeOne from 'memoize-one'
import { Baidu } from '@opentranslate/baidu'
import {
  MachineTranslateResult,
  MachineTranslatePayload,
  getMTArgs,
  machineResult
} from '@/components/MachineTrans/engine'
import { BaiduLanguage } from './config'

export const getTranslator = memoizeOne(
  () =>
    new Baidu({
      env: 'ext',
      // MV3: pass the main bundle's axios (with fetch adapter installed)
      axios: axios as any,
      config:
        process.env.BAIDU_APPID && process.env.BAIDU_KEY
          ? {
              appid: process.env.BAIDU_APPID,
              key: process.env.BAIDU_KEY
            }
          : undefined
    })
)

export const getSrcPage: GetSrcPageFunction = (text, config, profile) => {
  const lang =
    profile.dicts.all.baidu.options.tl === 'default'
      ? config.langCode === 'zh-CN'
        ? 'zh'
        : config.langCode === 'zh-TW'
        ? 'cht'
        : 'en'
      : profile.dicts.all.baidu.options.tl

  return `https://fanyi.baidu.com/#auto/${lang}/${text}`
}

export type BaiduResult = MachineTranslateResult<'baidu'>

export const search: SearchFunction<
  BaiduResult,
  MachineTranslatePayload<BaiduLanguage>
> = async (rawText, config, profile, payload) => {
  const translator = getTranslator()

  const { sl, tl, text } = await getMTArgs(
    translator,
    rawText,
    profile.dicts.all.baidu,
    config,
    payload
  )

  const appid = config.dictAuth.baidu.appid
  const key = config.dictAuth.baidu.key
  const translatorConfig = appid && key ? { appid, key } : undefined

  if (!translatorConfig && !(process.env.BAIDU_APPID && process.env.BAIDU_KEY)) {
    return machineResult(
      {
        result: {
          requireCredential: true,
          id: 'baidu',
          sl: 'auto',
          tl: 'auto',
          slInitial: 'hide',
          searchText: { paragraphs: [''] },
          trans: { paragraphs: [''] }
        }
      },
      []
    )
  }

  const result = await translator.translate(text, sl, tl, translatorConfig)
  return machineResult(
    {
      result: {
        id: 'baidu',
        slInitial: profile.dicts.all.baidu.options.slInitial,
        sl: result.from,
        tl: result.to,
        searchText: result.origin,
        trans: result.trans
      },
      audio: {
        py: result.trans.tts,
        us: result.trans.tts
      }
    },
    translator.getSupportLanguages()
  )
}
