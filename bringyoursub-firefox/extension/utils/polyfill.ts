/**
 * Browser API Polyfill for Firefox MV2
 * 
 * Firefox MV2 uses the 'browser' namespace with Promises,
 * while Chrome MV3 uses 'chrome' with callbacks.
 * This polyfill ensures both work with the 'chrome' namespace.
 */

// Detect environment
const isFirefox = typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';

if (isFirefox) {
    console.log('[BringYourSub] Firefox detected, applying browser polyfill');

    // @ts-ignore - Override chrome with browser
    (globalThis as any).chrome = browser;
}

export { };
