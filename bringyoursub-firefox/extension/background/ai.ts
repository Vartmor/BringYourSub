/**
 * BringYourSub - Background Service Worker
 * 
 * Handles the main subtitle generation pipeline including:
 * - Request transcript from content script
 * - Robust per-chunk translation with retry logic
 * - SRT format generation
 * - Progress reporting to popup
 * 
 * @module background/ai
 */

// =====================
// Firefox Polyfill (MUST BE FIRST)
// =====================
declare const browser: typeof chrome | undefined;
if (typeof browser !== 'undefined') {
    (globalThis as any).chrome = browser;
}

import { chunkTranscript, estimateTranscript } from "../../shared/ai-core/chunker.js";
import { AIPipeline } from "../../shared/ai-core/pipeline.js";

/** Message payload for subtitle generation requests */
interface GenerateSubtitlesRequest {
    action: "GENERATE_SUBTITLES";
    videoId: string;
    apiKey: string;
    language: string;
    model?: string;
    videoTitle: string;
}

/** Response payload for subtitle generation */
interface GenerateSubtitlesResponse {
    subtitles?: string;
    usedWhisper?: boolean;
    warning?: string;
    stats?: {
        totalChunks: number;
        successfulChunks: number;
        failedChunks: number;
    };
    error?: string;
}

/**
 * Listen for messages from the popup
 */
chrome.runtime.onMessage.addListener((
    message: GenerateSubtitlesRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: GenerateSubtitlesResponse) => void
): boolean => {
    if (message.action === "GENERATE_SUBTITLES") {
        handleGenerateSubtitles(message, sendResponse);
        return true; // Keep message channel open for async response
    }
    return false;
});

/**
 * Main pipeline handler for subtitle generation
 */
async function handleGenerateSubtitles(
    data: GenerateSubtitlesRequest,
    sendResponse: (response: GenerateSubtitlesResponse) => void
): Promise<void> {
    const { apiKey, language, model, videoTitle } = data;
    let warning: string | undefined;

    try {
        // Stage 1: Get transcript from content script
        notifyPopup("Extracting transcript from video...", 1, 4);

        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;

        if (!tabId) {
            throw new Error("No active YouTube tab found");
        }

        // Request transcript from content script
        let transcript: string | null = null;
        try {
            const response = await new Promise<{ transcript: string | null }>((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, { action: 'GET_TRANSCRIPT' }, (resp) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(resp || { transcript: null });
                    }
                });
            });
            transcript = response.transcript;
            console.log('[BringYourSub] Transcript received, length:', transcript?.length || 0);
        } catch (err) {
            console.log('[BringYourSub] Content script transcript failed:', err);
        }

        if (!transcript) {
            throw new Error("No captions available for this video. Please try a video with auto-generated or manual captions.");
        }

        // Stage 2: Analyze and Chunk
        notifyPopup("Analyzing transcript length...", 2, 4);
        const estimates = estimateTranscript(transcript);

        if (estimates.warningMessage) {
            notifyPopup(estimates.warningMessage, 2, 4);
            warning = estimates.warningMessage;
        }

        notifyPopup(`Splitting into chunks (est. ${estimates.estimatedDuration} min video)...`, 2, 4);
        const chunks = chunkTranscript(transcript);

        notifyPopup(`Processing ${chunks.length} parts...`, 2, 4);

        // Stage 3: Translation Pipeline
        const pipeline = new AIPipeline({
            apiKey,
            targetLanguage: language,
            model: model || "gpt-4o-mini",
            videoMetadata: {
                title: videoTitle,
                channel: "YouTube Video"
            },
            onProgress: (msg) => {
                notifyPopup(msg, 3, 4);
            }
        });

        const result = await pipeline.translateChunks(chunks);

        notifyPopup("Generation complete!", 4, 4);

        sendResponse({
            subtitles: result.srt,
            usedWhisper: false,
            warning,
            stats: {
                totalChunks: result.stats.totalChunks,
                successfulChunks: result.stats.successfulChunks,
                failedChunks: result.stats.failedChunks
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("[BringYourSub] Pipeline error:", error);

        // Provide helpful error messages
        let userMessage = errorMessage;
        if (errorMessage.includes("Invalid API")) {
            userMessage = "Invalid API Key. Please check your key in Settings.";
        } else if (errorMessage.includes("rate limit")) {
            userMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (errorMessage.includes("quota")) {
            userMessage = "API quota exceeded. Check your OpenAI billing settings.";
        }

        sendResponse({ error: userMessage });
    }
}

/**
 * Sends progress update to popup
 */
function notifyPopup(text: string, step: number, totalSteps: number): void {
    try {
        const result = chrome.runtime.sendMessage({
            action: "UPDATE_PROGRESS",
            text,
            step,
            totalSteps
        });
        // Handle Promise (Firefox) or undefined (popup closed)
        if (result && typeof result.catch === 'function') {
            result.catch(() => {
                // Popup may be closed, ignore
            });
        }
    } catch {
        // Ignore errors when popup is closed
    }
}
