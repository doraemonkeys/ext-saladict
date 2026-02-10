import { fetchDirtyDOM } from '@/_helpers/fetch-dom'
import {
  HTMLString,
  getInnerHTML,
  handleNoResult,
  handleNetWorkError,
  SearchFunction,
  GetSrcPageFunction,
  DictSearchResult
} from '../helpers'
import { getStaticSpeaker } from '@/components/Speaker'

export const getSrcPage: GetSrcPageFunction = text => {
  return `https://www.zdic.net/hans/${encodeURIComponent(text)}`
}

const HOST = 'https://www.zdic.net'

export type ZdicResult = Array<{
  title: string
  content: HTMLString
}>

type ZdicSearchResult = DictSearchResult<ZdicResult>

export const search: SearchFunction<ZdicResult> = (
  text,
  config,
  profile,
  payload
) => {
  const isAudio = profile.dicts.all.zdic.options.audio

  return fetchDirtyDOM(
    'https://www.zdic.net/hans/' + encodeURIComponent(text.replace(/\s+/g, ' '))
  )
    .catch(handleNetWorkError)
    .then(doc => handleDOM(doc, isAudio))
}

function handleDOM(
  doc: Document,
  isAudio: boolean
): ZdicSearchResult | Promise<ZdicSearchResult> {
  const response: ZdicSearchResult = {
    result: []
  }

  for (const $entry of doc.querySelectorAll<HTMLDivElement>(
    '[data-type-block]'
  )) {
    // MV3: node-html-parser has no `dataset`; use getAttribute
    const title = $entry.getAttribute('data-type-block') || ''
    if (!/基本解释|词语解释|详细解释/.test(title)) {
      continue
    }

    for (const $a of $entry.querySelectorAll<HTMLAnchorElement>(
      '[data-src-mp3]'
    )) {
      if (isAudio) {
        const mp3Src = $a.getAttribute('data-src-mp3')
        if (!response.audio) {
          response.audio = {
            py: mp3Src || undefined
          }
        }
        $a.replaceWith(getStaticSpeaker(mp3Src))
      } else {
        $a.remove()
      }
    }

    response.result.push({
      title,
      content: getInnerHTML(HOST, $entry, '.content')
    })
  }

  return response.result.length > 0 ? response : handleNoResult()
}

// MV3: Referer header for zdic audio is now handled by a static
// declarativeNetRequest rule in src/declarative-net-request/rules.json.
// The old blocking webRequest.onBeforeSendHeaders listener has been removed.
