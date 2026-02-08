import { parse } from 'node-html-parser'
import axios, { AxiosRequestConfig } from 'axios'

/**
 * MV3: DOMParser / DOMPurify / XMLHttpRequest are all unavailable inside
 * a Service Worker.  We use `node-html-parser` (pure-JS HTML parser) instead
 * so that dictionary engines keep working without any API changes.
 *
 * `node-html-parser` provides querySelector / querySelectorAll / textContent /
 * innerHTML / getAttribute — the same DOM-like API the engines rely on.
 */

export function fetchDOM(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<DocumentFragment> {
  return axios(url, {
    ...config,
    transformResponse: [data => data],
    responseType: 'text'
  }).then(({ data }) => {
    const root = parse(data)
    return (root as unknown) as DocumentFragment
  })
}

/** about 6 time faster as it typically takes less than 5ms to parse a DOM */
export function fetchDirtyDOM(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<Document> {
  return axios(url, {
    withCredentials: false,
    ...config,
    transformResponse: [data => data],
    // MV3: 'document' responseType is XHR-only; use 'text' + node-html-parser
    responseType: 'text'
  }).then(({ data }) => {
    const root = parse(data)
    return (root as unknown) as Document
  })
}

export function fetchPlainText(
  url: string,
  config: AxiosRequestConfig = {}
): Promise<string> {
  return axios(url, {
    withCredentials: false,
    ...config,
    // axios bug https://github.com/axios/axios/issues/907
    transformResponse: [data => data],
    responseType: 'text'
  }).then(({ data }) => data)
}
