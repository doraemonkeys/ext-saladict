/**
 * MV3: Custom fetch-based adapter for axios 0.21.x
 *
 * In Chrome MV3 service workers, XMLHttpRequest is unavailable.
 * Axios 0.21.x only ships XHR (browser) and http (Node) adapters,
 * so when neither environment is detected the adapter is `undefined`,
 * causing: "TypeError: (e.adapter || a.adapter) is not a function".
 *
 * This module provides a drop-in adapter that uses the globally available
 * `fetch()` API instead.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

function buildURL(url: string | undefined, params: any): string {
  if (!url) return ''
  if (!params) return url

  let serialized: string
  if (params instanceof URLSearchParams) {
    serialized = params.toString()
  } else if (typeof params === 'string') {
    serialized = params
  } else {
    serialized = new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null
      ) as [string, string][]
    ).toString()
  }

  if (serialized) {
    url += (url.includes('?') ? '&' : '?') + serialized
  }
  return url
}

function buildBody(data: any): BodyInit | undefined {
  if (data === undefined || data === null) return undefined
  if (typeof data === 'string') return data
  if (data instanceof URLSearchParams) return data.toString()
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return data as ArrayBuffer
  }
  if (data instanceof Blob) return data
  if (data instanceof FormData) return data
  // Plain object → JSON
  return JSON.stringify(data)
}

export async function fetchAdapter(
  config: AxiosRequestConfig
): Promise<AxiosResponse> {
  const url = buildURL(config.url, config.params)
  const method = (config.method || 'GET').toUpperCase()

  const headers = new Headers()
  if (config.headers) {
    for (const [key, value] of Object.entries(config.headers)) {
      if (value !== undefined && value !== null) {
        headers.set(key, String(value))
      }
    }
  }

  // Auto-set Content-Type for JSON bodies when not already set
  const body = buildBody(config.data)
  if (
    body &&
    typeof body === 'string' &&
    !headers.has('Content-Type') &&
    !(config.data instanceof URLSearchParams)
  ) {
    try {
      JSON.parse(body)
      headers.set('Content-Type', 'application/json;charset=utf-8')
    } catch {
      // not JSON, leave Content-Type unset
    }
  }

  const fetchInit: RequestInit = {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
    credentials: config.withCredentials ? 'include' : 'same-origin',
    signal: config.cancelToken
      ? (() => {
          const ctrl = new AbortController()
          config.cancelToken!.promise.then(() => ctrl.abort())
          return ctrl.signal
        })()
      : undefined
  }

  // Handle timeout
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  if (config.timeout && config.timeout > 0 && !fetchInit.signal) {
    const ctrl = new AbortController()
    fetchInit.signal = ctrl.signal
    timeoutId = setTimeout(() => ctrl.abort(), config.timeout)
  }

  try {
    const response = await fetch(url, fetchInit)

    // Read response based on responseType
    let data: any
    const responseType = config.responseType || 'json'
    switch (responseType) {
      case 'arraybuffer':
        data = await response.arrayBuffer()
        break
      case 'blob':
        data = await response.blob()
        break
      case 'text':
      case 'document':
        data = await response.text()
        break
      case 'json':
      default:
        data = await response.text()
        try {
          data = JSON.parse(data)
        } catch {
          // keep as text if not valid JSON
        }
        break
    }

    // NOTE: Do NOT apply transformResponse here.
    // Axios core applies transformResponse after the adapter returns.
    // Applying it here would double-transform the data.

    const axiosResponse: AxiosResponse = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config,
      request: response
    }

    // Validate status (mimic axios behaviour)
    const validateStatus =
      config.validateStatus || ((s: number) => s >= 200 && s < 300)
    if (!validateStatus(response.status)) {
      const error: any = new Error(
        `Request failed with status code ${response.status}`
      )
      error.config = config
      error.response = axiosResponse
      error.isAxiosError = true
      throw error
    }

    return axiosResponse
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Install the fetch adapter as the global default for axios.
 * Call this once at the top of the service worker entry (before any requests).
 */
export function installFetchAdapter(): void {
  ;(axios.defaults as any).adapter = fetchAdapter
}
