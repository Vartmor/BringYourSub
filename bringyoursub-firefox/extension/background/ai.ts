/**
 * BringYourSub - Background Service Worker
 * 
 * Handles the main subtitle generation pipeline including:
 * - Native YouTube transcript extraction
 * - Whisper API fallback with cost warnings
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

import { getNativeYouTubeTranscript } from "../../shared/ai-core/transcript.js";
import { getWhisperTranscript, whisperSegmentsToSRT } from "../../shared/ai-core/whisper.js";
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
    const { videoId, apiKey, language, model, videoTitle } = data;
    let usedWhisper = false;
    let warning: string | undefined;

    try {
        // Stage 1: Try Native Transcript
        notifyPopup("Checking for native transcript...", 1, 4);
        let transcript = await getNativeYouTubeTranscript(videoId);

        // Stage 2: Fallback to Whisper
        if (!transcript) {
            notifyPopup("No captions found. Using Whisper (may cost $)...", 1, 4);
            usedWhisper = true;

            const whisperResult = await getWhisperTranscript(videoId, apiKey, (warn) => {
                notifyPopup(warn, 1, 4);
                warning = warn;
            });

            if (!whisperResult || !whisperResult.text) {
                throw new Error(whisperResult?.warning || "Could not transcribe audio");
            }

            // If Whisper provides segments with timestamps, use them directly
            if (whisperResult.segments && whisperResult.segments.length > 0) {
                notifyPopup("Whisper transcription complete. Translating...", 2, 4);

                // Translate the whole text (Whisper already has timestamps)
                const pipeline = new AIPipeline({
                    apiKey,
                    targetLanguage: language,
                    model: model || "gpt-4o-mini",
                    videoMetadata: { title: videoTitle, channel: "YouTube" },
                    onProgress: (msg, current, total) => notifyPopup(msg, 3, 4)
                });

                // Chunk and translate
                const chunks = chunkTranscript(whisperResult.text);
                const result = await pipeline.translateChunks(chunks);

                sendResponse({
                    subtitles: result.srt,
                    usedWhisper: true,
                    warning: whisperResult.warning,
                    stats: {
                        totalChunks: result.stats.totalChunks,
                        successfulChunks: result.stats.successfulChunks,
                        failedChunks: result.stats.failedChunks
                    }
                });
                return;
            }

            transcript = whisperResult.text;
            warning = whisperResult.warning;
        }

        if (!transcript) {
            throw new Error("Could not acquire transcript via any method.");
        }

        // Stage 3: Analyze and Chunk
        notifyPopup("Analyzing transcript length...", 2, 4);
        const estimates = estimateTranscript(transcript);

        if (estimates.warningMessage) {
            notifyPopup(estimates.warningMessage, 2, 4);
            warning = estimates.warningMessage;
        }

        notifyPopup(`Splitting into chunks (est. ${estimates.estimatedDuration} min video)...`, 2, 4);
        const chunks = chunkTranscript(transcript);

        notifyPopup(`Processing ${chunks.length} parts...`, 2, 4);

        // Stage 4: Translation Pipeline
        const pipeline = new AIPipeline({
            apiKey,
            targetLanguage: language,
            model: model || "gpt-4o-mini",
            videoMetadata: {
                title: videoTitle,
                channel: "YouTube Video"
            },
            onProgress: (msg, current, total) => {
                notifyPopup(msg, 3, 4);
            }
        });

        pipeline.setUsedWhisper(usedWhisper);

        const result = await pipeline.translateChunks(chunks);

        notifyPopup("Generation complete!", 4, 4);

        sendResponse({
            subtitles: result.srt,
            usedWhisper,
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
        } else if (errorMessage.includes("25MB")) {
            userMessage = "Video audio is too large. Try a shorter video (under 25 minutes).";
        }

        sendResponse({ error: userMessage, usedWhisper });
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
