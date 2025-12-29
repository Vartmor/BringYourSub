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
import { getNativeYouTubeTranscript } from "../../shared/ai-core/transcript.js";
import { getWhisperTranscript } from "../../shared/ai-core/whisper.js";

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
 * Listen for messages from popup or content script
 */
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message.action === 'GENERATE_SUBTITLES') {
        handleGenerateSubtitles(message)
            .then((response) => sendResponse(response)) // Pass the full response from handleGenerateSubtitles
            .catch(error => {
                console.error('[BringYourSub] Generate error:', error);
                sendResponse({ error: error.message }); // Send error in the expected format
            });
        return true; // Keep channel open
    }

    if (message.action === 'FETCH_TRANSCRIPT') {
        const url = message.url;
        console.log('[BringYourSub] Background fetching transcript:', url);

        if (!url) {
            console.error('[BringYourSub] Fetch error: URL is missing');
            sendResponse({ success: false, error: 'URL is missing' });
            return true;
        }

        console.log('[BringYourSub] Background fetch URL:', url.substring(0, 100) + '...');

        // Helper function to perform fetch
        const performFetch = async (withCredentials: boolean): Promise<string> => {
            const response = await fetch(url, {
                credentials: withCredentials ? 'include' : 'omit',
                headers: {
                    'Accept': 'text/xml, application/json, text/plain, */*'
                }
            });
            console.log('[BringYourSub] Fetch status:', response.status, response.statusText, 'credentials:', withCredentials);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        };

        // Try with credentials first, then without
        (async () => {
            try {
                let text = await performFetch(true);

                // If empty, retry without credentials
                if (!text || text.length === 0) {
                    console.log('[BringYourSub] Empty response with credentials, retrying without...');
                    text = await performFetch(false);
                }

                if (text && text.length > 0) {
                    console.log('[BringYourSub] Transcript fetched successfully, length:', text.length);
                    sendResponse({ success: true, text });
                } else {
                    throw new Error('Empty response body after all attempts');
                }
            } catch (error) {
                console.error('[BringYourSub] Background fetch failed:', error);
                const errorMsg = error instanceof Error ? error.message : String(error);
                sendResponse({ success: false, error: errorMsg || 'Unknown fetch error' });
            }
        })();
        return true;
    }
    return false;
});

/**
 * Main pipeline handler for subtitle generation
 */
async function handleGenerateSubtitles(
    data: GenerateSubtitlesRequest,
): Promise<GenerateSubtitlesResponse> {
    const { apiKey, language, model, videoTitle } = data;
    let warning: string | undefined;

    try {
        // Stage 1: Get transcript from content script
        notifyPopup("Extracting transcript from video...", 1, 4);

        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        const tabUrl = tabs[0]?.url;

        if (!tabId) {
            throw new Error("No active YouTube tab found");
        }

        if (!tabUrl?.includes('youtube.com/watch')) {
            throw new Error("Please open a YouTube video page first");
        }

        // Request transcript from content script (with injection fallback)
        let transcript: string | null = null;
        let usedWhisper = false;

        // First, try to inject the content script programmatically
        // This ensures it's loaded even if the tab was open before the extension
        try {
            console.log('[BringYourSub] Injecting content scripts...');
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['extension/content/youtube.js']
            });
            console.log('[BringYourSub] Content script injected successfully');

            // Small delay to let the script initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (injectionErr) {
            // Script might already be loaded, that's OK
            console.log('[BringYourSub] Script injection note:', injectionErr);
        }

        // Now try to get the transcript
        try {
            const response = await new Promise<{ transcript: string | null }>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Content script response timeout'));
                }, 10000);

                chrome.tabs.sendMessage(tabId, { action: 'GET_TRANSCRIPT' }, (resp) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(resp || { transcript: null });
                    }
                });
            });
            transcript = response.transcript;
            console.log('[BringYourSub] Content script transcript result, length:', transcript?.length || 0);
        } catch (err) {
            console.log('[BringYourSub] Content script transcript failed:', err);
        }

        // Fallback: If content script approach failed, try fetching directly from background
        if (!transcript) {
            console.log('[BringYourSub] Trying background-based transcript fetch as fallback...');
            notifyPopup("Trying alternative extraction method...", 1, 4);

            // Extract video ID from URL
            const videoIdMatch = tabUrl?.match(/[?&]v=([^&]+)/);
            const videoId = videoIdMatch?.[1];

            if (videoId) {
                try {
                    transcript = await getNativeYouTubeTranscript(videoId);
                    if (transcript) {
                        console.log('[BringYourSub] Background fetch succeeded, length:', transcript.length);
                    }
                } catch (bgErr) {
                    console.error('[BringYourSub] Background fetch also failed:', bgErr);
                }
            }
        }

        // Extract video ID for Whisper fallback
        const videoIdMatch = tabUrl?.match(/[?&]v=([^&]+)/);
        const videoId = videoIdMatch?.[1];

        // Final Fallback: Use Whisper API to transcribe the audio
        if (!transcript && videoId) {
            console.log('[BringYourSub] All transcript methods failed, trying Whisper transcription...');
            notifyPopup("No captions found. Using Whisper to transcribe audio...", 1, 4);

            try {
                const whisperResult = await getWhisperTranscript(
                    videoId,
                    apiKey,
                    (msg) => {
                        notifyPopup(msg, 1, 4);
                        if (msg.includes('⚠️')) {
                            warning = msg;
                        }
                    }
                );

                if (whisperResult?.text) {
                    transcript = whisperResult.text;
                    usedWhisper = true;
                    console.log('[BringYourSub] Whisper transcription succeeded, length:', transcript.length);
                    notifyPopup("Audio transcribed successfully!", 1, 4);
                }
            } catch (whisperErr) {
                console.error('[BringYourSub] Whisper transcription failed:', whisperErr);
                const whisperError = whisperErr instanceof Error ? whisperErr.message : String(whisperErr);
                throw new Error(`No captions available and Whisper transcription failed: ${whisperError}`);
            }
        }

        if (!transcript) {
            throw new Error("No captions available for this video. Please try a video with captions or check your OpenAI API key for Whisper transcription.");
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

        return {
            subtitles: result.srt,
            usedWhisper: false,
            warning,
            stats: {
                totalChunks: result.stats.totalChunks,
                successfulChunks: result.stats.successfulChunks,
                failedChunks: result.stats.failedChunks
            }
        };
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

        return { error: userMessage };
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
