// MV3: Install fetch-based adapter before any axios calls.
// XMLHttpRequest is unavailable in service workers, so the default
// axios adapter resolves to `undefined` and throws at runtime.
import { installFetchAdapter } from '@/_helpers/axios-fetch-adapter'
installFetchAdapter()

export {}
;(globalThis as any).__SALADICT_INTERNAL_PAGE__ = true
;(globalThis as any).__SALADICT_BACKGROUND_PAGE__ = true
