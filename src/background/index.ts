import './env'
import './initialization'
import { getConfig, addConfigListener } from '@/_helpers/config-manager'
import {
  createActiveProfileStream,
  createProfileIDListStream
} from '@/_helpers/profile-manager'
import { message } from '@/_helpers/browser-api'
import { startSyncServiceInterval } from './sync-manager'
import { init as initPdf } from './pdf-sniffer'
import { ContextMenus } from './context-menus'
import { BackgroundServer } from './server'
import { initBadge } from './badge'
import { setupCaiyunTrsBackend } from './page-translate/caiyun'
import { setupRequestGAListener } from '@/_helpers/analytics'
import {
  setAppConfig,
  setActiveProfile,
  setProfileIDList,
  restoreStateFromSession,
  saveStateToSession
} from './state'

// init first to recevice self messaging
message.self.initServer()

startSyncServiceInterval()

ContextMenus.init()
BackgroundServer.init()

setupCaiyunTrsBackend()

setupRequestGAListener()

// ---------------------------------------------------------------------------
// MV3: Register event listeners synchronously at the top level so they
// survive service-worker restarts.  Handlers read config from state at
// runtime rather than capturing a config parameter at registration time.
// ---------------------------------------------------------------------------
initPdf()
initBadge()
addConfigListener(({ newConfig }) => {
  setAppConfig(newConfig)
  saveStateToSession()
})

// ---------------------------------------------------------------------------
// MV3: Restore persisted state from session storage as early as possible so
// that event handlers firing before getConfig() resolves have cached config.
// ---------------------------------------------------------------------------
restoreStateFromSession()

// ---------------------------------------------------------------------------
// Async config / profile loading (source of truth from extension storage)
// ---------------------------------------------------------------------------
getConfig().then(config => {
  setAppConfig(config)
  saveStateToSession()
})

createActiveProfileStream().subscribe(profile => {
  setActiveProfile(profile)
  saveStateToSession()
})

createProfileIDListStream().subscribe(list => {
  setProfileIDList(list)
  saveStateToSession()
})
