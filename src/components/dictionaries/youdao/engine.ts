import { fetchDirtyDOM } from '@/_helpers/fetch-dom'
import {
  getText,
  getInnerHTML,
  handleNoResult,
  HTMLString,
  handleNetWorkError,
  SearchFunction,
  GetSrcPageFunction,
  DictSearchResult,
  getChsToChz,
  removeChild
} from '../helpers'
import { DictConfigs } from '@/app-config'

/** Sanitise text for use in the dict.youdao.com/w/ URL path.
 *  Forward-slashes cause the server to split the path (it decodes %2F). */
function sanitizeForURL(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\//g, ' ')
}

export const getSrcPage: GetSrcPageFunction = text =>
  'https://dict.youdao.com/w/' + encodeURIComponent(sanitizeForURL(text))

const HOST = 'http://www.youdao.com'

export interface YoudaoResultLex {
  type: 'lex'
  title: string
  stars: number
  rank: string
  pattern: string
  prons: Array<{
    phsym: string
    url: string
  }>
  basic?: HTMLString
  collins: Array<{
    title: string
    content: HTMLString
  }>
  discrimination?: HTMLString
  sentence?: HTMLString
  translation?: HTMLString
}

export interface YoudaoResultRelated {
  type: 'related'
  list: HTMLString
}

export type YoudaoResult = YoudaoResultLex | YoudaoResultRelated

type YoudaoSearchResult = DictSearchResult<YoudaoResult>

export const search: SearchFunction<YoudaoResult> = async (
  text,
  config,
  profile,
  payload
) => {
  const options = profile.dicts.all.youdao.options
  const transform = await getChsToChz(config.langCode)

  return fetchDirtyDOM(
    'https://dict.youdao.com/w/' + encodeURIComponent(sanitizeForURL(text))
  )
    .catch(handleNetWorkError)
    .then(doc => checkResult(doc, options, transform))
}

function checkResult(
  doc: Document,
  options: DictConfigs['youdao']['options'],
  transform: null | ((text: string) => string)
): YoudaoSearchResult | Promise<YoudaoSearchResult> {
  const $typo = doc.querySelector('.error-typo')
  if (!$typo) {
    return handleDOM(doc, options, transform)
  }
  // Typo suggestions are the only useful content when main results are empty —
  // show them unconditionally (options.related only gates *supplementary* data).
  return {
    result: {
      type: 'related',
      list: getInnerHTML(HOST, $typo, { transform })
    }
  }
}

function handleDOM(
  doc: Document,
  options: DictConfigs['youdao']['options'],
  transform: null | ((text: string) => string)
): YoudaoSearchResult | Promise<YoudaoSearchResult> {
  const result: YoudaoResult = {
    type: 'lex',
    title: getText(doc, '.keyword', transform),
    stars: 0,
    rank: getText(doc, '.rank'),
    pattern: getText(doc, '.pattern', transform),
    prons: [],
    collins: []
  }

  const audio: { uk?: string; us?: string } = {}

  const $star = doc.querySelector('.star')
  if ($star) {
    // MV3: node-html-parser has no `className` property; use getAttribute
    result.stars = Number(
      (($star.getAttribute('class') || '').match(/\d+/) || [0])[0]
    )
  }

  doc.querySelectorAll('.baav .pronounce').forEach($pron => {
    const phsym = $pron.textContent || ''
    const $voice = $pron.querySelector<HTMLAnchorElement>('.dictvoice')
    // MV3: node-html-parser has no `dataset`; use getAttribute
    const voiceRel = $voice && $voice.getAttribute('data-rel')
    if ($voice && voiceRel) {
      const url =
        'https://dict.youdao.com/dictvoice?audio=' + voiceRel

      result.prons.push({ phsym, url })

      if (phsym.includes('英')) {
        audio.uk = url
      } else if (phsym.includes('美')) {
        audio.us = url
      }
    }
  })

  if (options.basic) {
    result.basic = getInnerHTML(HOST, doc, {
      selector: '#phrsListTab .trans-container',
      transform
    })
  }

  if (options.collins) {
    doc.querySelectorAll('#collinsResult .wt-container').forEach($container => {
      const item = { title: '', content: '' }

      const $title = $container.querySelector(':scope > .title.trans-tip')
      if ($title) {
        removeChild($title, '.do-detail')
        item.title = getText($title)
        $title.remove()
      }

      const $star = $container.querySelector('.star')
      if ($star) {
        // MV3: node-html-parser has no `className`; use getAttribute
        const starMatch = /star(\d+)/.exec(
          $star.getAttribute('class') || ''
        )
        if (starMatch) {
          const rate = +starMatch[1]
          let stars = ''
          for (let i = 0; i < 5; i++) {
            stars += `<svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 426.67 426.67"
              width="1em"
              height="1em"
              style="${i === 4 ? '' : 'margin-right: 1px'}"
            >
              <path
                fill=${i < rate ? '#FAC917' : '#d1d8de'}
                d="M213.33 10.44l65.92 133.58 147.42 21.42L320 269.4l25.17 146.83-131.84-69.32-131.85 69.34 25.2-146.82L0 165.45l147.4-21.42"
              />
            </svg>`
          }
          $star.innerHTML = stars
        }
      }

      item.content = getInnerHTML(HOST, $container, { transform })
      if (item.content) {
        result.collins.push(item)
      }
    })
  }

  if (options.discrimination) {
    result.discrimination = getInnerHTML(HOST, doc, {
      selector: '#discriminate',
      transform
    })
  }

  if (options.sentence) {
    result.sentence = getInnerHTML(HOST, doc, {
      selector: '#authority .ol',
      transform
    })
  }

  if (options.translation || !result.title) {
    // Always extract machine translation when there is no dictionary match
    // (i.e. long text / sentences), so we can fall back to it.
    result.translation = getInnerHTML(HOST, doc, {
      selector: '#fanyiToggle .trans-container',
      transform
    })
  }

  if (result.title || result.translation) {
    return { result, audio }
  }
  return handleNoResult()
}
