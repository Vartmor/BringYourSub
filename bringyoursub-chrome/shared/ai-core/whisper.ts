/**
 * Whisper Transcription Module
 * 
 * Provides robust audio transcription via OpenAI's Whisper API:
 * - File size validation (25MB limit)
 * - Long audio detection with warnings
 * - Timestamp extraction for SRT
 * - Error handling with helpful messages
 * 
 * @module ai-core/whisper
 */

/** Whisper API response structure */
interface WhisperResponse {
    text: string;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    error?: {
        message: string;
    };
}

/** YouTube adaptive stream format */
interface AdaptiveFormat {
    mimeType: string;
    url?: string;
    contentLength?: string;
    approxDurationMs?: string;
}

/** Whisper transcription result */
export interface WhisperResult {
    text: string;
    segments?: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    warning?: string;
    estimatedCost?: number;
}

/** Audio info extracted from YouTube */
interface AudioInfo {
    url: string;
    size: number; // bytes
    duration: number; // seconds
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const WHISPER_COST_PER_MINUTE = 0.006; // $0.006 per minute

/**
 * Gets audio info from YouTube video
 */
async function getYouTubeAudioInfo(videoId: string): Promise<AudioInfo | null> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const html = await response.text();

        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (!playerResponseMatch) return null;

        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const streamingData = playerResponse.streamingData;
        if (!streamingData?.adaptiveFormats) return null;

        // Find audio-only format with smallest size
        const audioFormats = (streamingData.adaptiveFormats as AdaptiveFormat[])
            .filter(f => f.mimeType?.startsWith("audio/") && f.url)
            .sort((a, b) => {
                const sizeA = parseInt(a.contentLength || "0", 10);
                const sizeB = parseInt(b.contentLength || "0", 10);
                return sizeA - sizeB;
            });

        const audioFormat = audioFormats[0];
        if (!audioFormat?.url) return null;

        const size = parseInt(audioFormat.contentLength || "0", 10);
        const duration = parseInt(audioFormat.approxDurationMs || "0", 10) / 1000;

        return {
            url: audioFormat.url,
            size,
            duration
        };
    } catch (error) {
        console.error("[BringYourSub] Error getting audio info:", error);
        return null;
    }
}

/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats duration for display
 */
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hrs}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
}

/**
 * Transcribes a YouTube video using OpenAI's Whisper API
 * 
 * @param videoId - The YouTube video ID
 * @param apiKey - OpenAI API key
 * @param onWarning - Callback for warnings (large file, cost estimate)
 * @returns Transcription result with text and optional segments
 */
export async function getWhisperTranscript(
    videoId: string,
    apiKey: string,
    onWarning?: (message: string) => void
): Promise<WhisperResult | null> {
    try {
        // Step 1: Get audio info and validate
        const audioInfo = await getYouTubeAudioInfo(videoId);
        if (!audioInfo) {
            throw new Error("Could not extract audio from YouTube video");
        }

        // Step 2: Check file size
        if (audioInfo.size > MAX_FILE_SIZE) {
            const message = `Audio file too large (${formatFileSize(audioInfo.size)}). Maximum is 25MB. Try a shorter video.`;
            onWarning?.(message);
            throw new Error(message);
        }

        // Step 3: Estimate cost and warn user
        const estimatedMinutes = audioInfo.duration / 60;
        const estimatedCost = estimatedMinutes * WHISPER_COST_PER_MINUTE;

        if (estimatedMinutes > 10) {
            const warning = `⚠️ Using Whisper transcription (no captions available). Duration: ${formatDuration(audioInfo.duration)}. Estimated cost: ~$${estimatedCost.toFixed(3)}`;
            onWarning?.(warning);
        }

        // Step 4: Download audio
        console.log(`[BringYourSub] Downloading audio (${formatFileSize(audioInfo.size)})...`);
        const audioResponse = await fetch(audioInfo.url);

        if (!audioResponse.ok) {
            throw new Error("Failed to download audio from YouTube");
        }

        const audioBlob = await audioResponse.blob();

        // Step 5: Send to Whisper API with verbose output for timestamps
        console.log("[BringYourSub] Sending to Whisper API...");
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.mp4");
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "segment");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const error: WhisperResponse = await response.json();
            const errorMessage = error.error?.message || "Whisper API request failed";

            if (errorMessage.includes("rate limit")) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            }
            if (errorMessage.includes("quota")) {
                throw new Error("API quota exceeded. Check your OpenAI billing.");
            }

            throw new Error(errorMessage);
        }

        const data: WhisperResponse = await response.json();

        return {
            text: data.text,
            segments: data.segments,
            estimatedCost,
            warning: estimatedMinutes > 10 ? `Whisper transcription used. Cost: ~$${estimatedCost.toFixed(3)}` : undefined
        };
    } catch (error) {
        console.error("[BringYourSub] Whisper error:", error);

        if (error instanceof Error) {
            return {
                text: "",
                warning: error.message
            };
        }

        return null;
    }
}

/**
 * Converts Whisper segments to SRT format
 */
export function whisperSegmentsToSRT(
    segments: Array<{ start: number; end: number; text: string }>
): string {
    const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };

    return segments.map((segment, index) => {
        return `${index + 1}\n${formatTime(segment.start)} --> ${formatTime(segment.end)}\n${segment.text.trim()}\n`;
    }).join('\n');
}
