/**
 * BringYourSub - YouTube Content Script
 *
 * Runs on YouTube video pages to extract metadata
 * that can be used by the background script for context.
 *
 * @module content/youtube
 */

/** Metadata extracted from the YouTube page */
interface VideoMetadata {
    title: string;
    channel: string;
}

console.log("[BringYourSub] Content script active on YouTube");

/**
 * Listen for metadata requests from the background script.
 * Extracts video title and channel name from the DOM.
 */
chrome.runtime.onMessage.addListener((
    message: { action: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (metadata: VideoMetadata) => void
): boolean | void => {
    if (message.action === "GET_METADATA") {
        const title = document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim() || "Unknown";
        const channel = document.querySelector("ytd-channel-name #text")?.textContent?.trim() || "Unknown";
        sendResponse({ title, channel });
        return true;
    }
});

