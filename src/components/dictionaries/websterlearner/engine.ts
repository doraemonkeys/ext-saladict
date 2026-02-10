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
import { DictConfigs } from '@/app-config'

export const getSrcPage: GetSrcPageFunction = text => {
  return `http://www.learnersdictionary.com/definition/${encodeURIComponent(
    text.trim().split(/\s+/).join('-')
  )}`
}

const HOST = 'http://www.learnersdictionary.com'

interface WebsterLearnerResultItem {
  title: HTMLString
  pron?: string

  infs?: HTMLString
  infsPron?: string

  labels?: HTMLString
  senses?: HTMLString
  phrases?: HTMLString
  derived?: HTMLString
  arts?: string[]
}

export interface WebsterLearnerResultLex {
  type: 'lex'
  items: WebsterLearnerResultItem[]
}

export interface WebsterLearnerResultRelated {
  type: 'related'
  list: HTMLString
}

export type WebsterLearnerResult =
  | WebsterLearnerResultLex
  | WebsterLearnerResultRelated

type WebsterLearnerSearchResult = DictSearchResult<WebsterLearnerResult>
type WebsterLearnerSearchResultLex = DictSearchResult<WebsterLearnerResultLex>

export const search: SearchFunction<WebsterLearnerResult> = (
  text,
  config,
  profile,
  payload
) => {
  const options = profile.dicts.all.websterlearner.options

  return fetchDirtyDOM(
    'http://www.learnersdictionary.com/definition/' +
      text.toLocaleLowerCase().replace(/[^A-Za-z0-9]+/g, '-')
  )
    .catch(handleNetWorkError)
    .then(doc => checkResult(doc, options))
}

function checkResult(
  doc: Document,
  options: DictConfigs['websterlearner']['options']
): WebsterLearnerSearchResult | Promise<WebsterLearnerSearchResult> {
  const $alternative = doc.querySelector<HTMLAnchorElement>(
    '[id^="spelling"] .links'
  )
  if (!$alternative) {
    return handleDOM(doc, options)
  } else {
    return {
      result: {
        type: 'related',
        list: getInnerHTML(HOST, $alternative)
      }
    }
  }
}

function handleDOM(
  doc: Document,
  options: DictConfigs['websterlearner']['options']
): WebsterLearnerSearchResultLex | Promise<WebsterLearnerSearchResultLex> {
  doc.querySelectorAll('.d_hidden').forEach(el => el.remove())

  const result: WebsterLearnerResultLex = {
    type: 'lex',
    items: []
  }
  const audio: { us?: string } = {}

  doc.querySelectorAll('.entry').forEach($entry => {
    const entry: WebsterLearnerResultItem = {
      title: ''
    }

    const $headword = $entry.querySelector('.hw_d')
    if (!$headword) {
      return
    }
    const $pron = $headword.querySelector<HTMLAnchorElement>('.play_pron')
    if ($pron) {
      // MV3: node-html-parser has no `dataset`; use getAttribute
      const path = ($pron.getAttribute('data-lang') || '').replace('_', '/')
      const dir = $pron.getAttribute('data-dir') || ''
      const file = $pron.getAttribute('data-file') || ''
      entry.pron = `http://media.merriam-webster.com/audio/prons/${path}/mp3/${dir}/${file}.mp3`
      audio.us = entry.pron
      $pron.remove()
    }
    entry.title = getInnerHTML(HOST, $headword)

    const $headwordInfs = $entry.querySelector('.hw_infs_d')
    if ($headwordInfs) {
      const $pron = $headwordInfs.querySelector<HTMLAnchorElement>('.play_pron')
      if ($pron) {
        const path = ($pron.getAttribute('data-lang') || '').replace('_', '/')
        const dir = $pron.getAttribute('data-dir') || ''
        const file = $pron.getAttribute('data-file') || ''
        entry.infsPron = `http://media.merriam-webster.com/audio/prons/${path}/mp3/${dir}/${file}.mp3`
        $pron.remove()
      }
      entry.infs = getInnerHTML(HOST, $headwordInfs)
    }

    entry.labels = getInnerHTML(HOST, $entry, '.labels')

    if (options.defs) {
      entry.senses = getInnerHTML(HOST, $entry, '.sblocks')
    }

    if (options.phrase) {
      entry.phrases = getInnerHTML(HOST, $entry, '.dros')
    }

    if (options.derived) {
      entry.derived = getInnerHTML(HOST, $entry, '.uros')
    }

    if (options.arts) {
      entry.arts = Array.from(
        $entry.querySelectorAll<HTMLImageElement>('.arts img')
      ).map($img => $img.getAttribute('src') || '')
    }

    if (
      entry.senses ||
      entry.phrases ||
      entry.derived ||
      (entry.arts && entry.arts.length > 0)
    ) {
      result.items.push(entry)
    }
  })

  if (result.items.length > 0) {
    return { result, audio }
  }

  return handleNoResult()
}
