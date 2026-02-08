/**
 * Background state module — replaces window globals for MV3 service worker compatibility.
 *
 * Service workers can be terminated at any time, so critical state is persisted
 * to chrome.storage.session and restored on wake-up.
 */

import { AppConfig } from '@/app-config'
import { Profile, ProfileIDList } from '@/app-config/profiles'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _appConfig: AppConfig
let _activeProfile: Profile
let _profileIDList: ProfileIDList
let _qsPanelId: number | undefined
let _activeServices: Map<string, any> = new Map()

// ---------------------------------------------------------------------------
// AppConfig
// ---------------------------------------------------------------------------

export function getAppConfig(): AppConfig {
  return _appConfig
}

export function setAppConfig(config: AppConfig): void {
  _appConfig = config
}

// ---------------------------------------------------------------------------
// Active Profile
// ---------------------------------------------------------------------------

export function getActiveProfile(): Profile {
  return _activeProfile
}

export function setActiveProfile(profile: Profile): void {
  _activeProfile = profile
}

// ---------------------------------------------------------------------------
// Profile ID List
// ---------------------------------------------------------------------------

export function getProfileIDList(): ProfileIDList {
  return _profileIDList
}

export function setProfileIDList(list: ProfileIDList): void {
  _profileIDList = list
}

// ---------------------------------------------------------------------------
// Quick Search Panel window ID
// ---------------------------------------------------------------------------

export function getQsPanelId(): number | undefined {
  return _qsPanelId
}

export function setQsPanelId(id: number | undefined): void {
  _qsPanelId = id
}

// ---------------------------------------------------------------------------
// Active sync service instances
// ---------------------------------------------------------------------------

export function getActiveServices(): Map<string, any> {
  return _activeServices
}

export function setActiveServices(services: Map<string, any>): void {
  _activeServices = services
}

// ---------------------------------------------------------------------------
// chrome.storage.session persistence helpers
// ---------------------------------------------------------------------------

const SESSION_STATE_KEY = '__saladict_bg_state__'

interface PersistedState {
  appConfig?: AppConfig
  activeProfile?: Profile
  profileIDList?: ProfileIDList
  qsPanelId?: number
}

/**
 * Persist critical state to chrome.storage.session so it survives SW restarts.
 */
export async function saveStateToSession(): Promise<void> {
  const state: PersistedState = {
    appConfig: _appConfig,
    activeProfile: _activeProfile,
    profileIDList: _profileIDList,
    qsPanelId: _qsPanelId
  }

  try {
    await chrome.storage.session.set({ [SESSION_STATE_KEY]: state })
  } catch (e) {
    console.warn('[state] Failed to save state to session storage', e)
  }
}

/**
 * Restore state from chrome.storage.session after SW restart.
 * Returns true if state was successfully restored, false otherwise.
 */
export async function restoreStateFromSession(): Promise<boolean> {
  try {
    const result = await chrome.storage.session.get(SESSION_STATE_KEY)
    const state: PersistedState | undefined = result[SESSION_STATE_KEY]

    if (!state) return false

    if (state.appConfig) _appConfig = state.appConfig
    if (state.activeProfile) _activeProfile = state.activeProfile
    if (state.profileIDList) _profileIDList = state.profileIDList
    if (state.qsPanelId !== undefined) _qsPanelId = state.qsPanelId

    return true
  } catch (e) {
    console.warn('[state] Failed to restore state from session storage', e)
    return false
  }
}
