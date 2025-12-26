/**
 * Browser API Polyfill
 * 
 * Provides cross-browser compatibility between Chrome (MV3) and Firefox (MV2).
 * Firefox uses the 'browser' namespace while Chrome uses 'chrome'.
 * This polyfill ensures both work with the 'chrome' namespace.
 */

// @ts-ignore - browser may not exist in Chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Polyfill chrome namespace for Firefox
if (typeof chrome === 'undefined' || !chrome.storage) {
    // @ts-ignore
    globalThis.chrome = browserAPI;
}

export { browserAPI };
