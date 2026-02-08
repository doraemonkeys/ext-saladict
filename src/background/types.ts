/**
 * Window type augmentations for appConfig / activeProfile / profileIDList
 * have been removed. These globals are now managed by src/background/state.ts
 * as module-level variables with getter/setter functions, which is compatible
 * with MV3 service workers (no `window` global).
 */

export {}
