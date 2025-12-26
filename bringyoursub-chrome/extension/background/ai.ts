/**
 * BringYourSub - Background Service Worker
 * 
 * Handles the main subtitle generation pipeline including:
 * - Native YouTube transcript extraction
 * - Whisper API fallback for videos without captions
 * - Context-aware AI translation using OpenAI
 * 
 * @module background/ai
 */

import { getNativeYouTubeTranscript } from "../../shared/ai-core/transcript.js";
import { getWhisperTranscript } from "../../shared/ai-core/whisper.js";
import { chunkTranscript } from "../../shared/ai-core/chunker.js";
import { AIPipeline } from "../../shared/ai-core/pipeline.js";

/** Message payload for subtitle generation requests */
interface GenerateSubtitlesRequest {
    action: "GENERATE_SUBTITLES";
    videoId: string;
    apiKey: string;
    language: string;
    videoTitle: string;
}

/** Response payload for subtitle generation */
interface GenerateSubtitlesResponse {
    subtitles?: string;
    usedWhisper?: boolean;
    error?: string;
}

/**
 * Listen for messages from the popup to trigger subtitle generation.
 * Returns true to indicate async response handling.
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
 * Main pipeline handler for subtitle generation.
 * 
 * Pipeline stages:
 * 1. Attempt to fetch native YouTube transcript
 * 2. Fall back to Whisper transcription if no captions available
 * 3. Chunk the transcript for optimal context handling
 * 4. Run context-lock translation pipeline
 * 
 * @param data - The request payload containing video info and API credentials
 * @param sendResponse - Callback to send the response back to popup
 */
async function handleGenerateSubtitles(
    data: GenerateSubtitlesRequest,
    sendResponse: (response: GenerateSubtitlesResponse) => void
): Promise<void> {
    const { videoId, apiKey, language, videoTitle } = data;

    try {
        // Stage 1: Try Native Transcript
        notifyPopup("Checking for native transcript...");
        let transcript = await getNativeYouTubeTranscript(videoId);
        let usedWhisper = false;

        // Stage 2: Fallback to Whisper
        if (!transcript) {
            notifyPopup("No native transcript found. Falling back to Whisper (this may take a minute)...");
            transcript = await getWhisperTranscript(videoId, apiKey);
            usedWhisper = true;
        }

        if (!transcript) {
            throw new Error("Could not acquire transcript via any method.");
        }

        // Stage 3: Chunking
        notifyPopup("Processing context and chunking...");
        const chunks = chunkTranscript(transcript);

        // Stage 4: AI Pipeline
        const pipeline = new AIPipeline({
            apiKey,
            targetLanguage: language,
            videoMetadata: {
                title: videoTitle,
                channel: "YouTube Video"
            }
        });

        notifyPopup(`Translating (${chunks.length} parts)...`);
        const translatedSubtitles = await pipeline.runContextLockPipeline(chunks);

        sendResponse({ subtitles: translatedSubtitles, usedWhisper });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("[BringYourSub] Pipeline error:", error);
        sendResponse({ error: errorMessage });
    }
}

/**
 * Sends a progress update message to the popup UI.
 * @param text - The status message to display
 */
function notifyPopup(text: string): void {
    chrome.runtime.sendMessage({ action: "UPDATE_PROGRESS", text }).catch(() => {
        // Popup may be closed, ignore the error
    });
}
