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
 * Extracts a valid JSON object from a string starting at a given position
 * using balanced brace matching (handles nested objects properly)
 */
function extractJsonObject(str: string, startIndex: number): string | null {
    if (str[startIndex] !== '{') return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < str.length; i++) {
        const char = str[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\' && inString) {
            escapeNext = true;
            continue;
        }

        if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return str.substring(startIndex, i + 1);
                }
            }
        }
    }

    return null;
}

/**
 * Gets audio info from YouTube video
 */
async function getYouTubeAudioInfo(videoId: string): Promise<AudioInfo | null> {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = await response.text();
        console.log('[BringYourSub] Whisper: Got video page, length:', html.length);

        // Use balanced brace matching for proper JSON extraction
        const patterns = [
            /ytInitialPlayerResponse\s*=\s*/,
            /var\s+ytInitialPlayerResponse\s*=\s*/
        ];

        let playerResponse: any = null;

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match.index !== undefined) {
                const startIdx = match.index + match[0].length;
                const jsonStr = extractJsonObject(html, startIdx);
                if (jsonStr) {
                    try {
                        playerResponse = JSON.parse(jsonStr);
                        console.log('[BringYourSub] Whisper: Parsed ytInitialPlayerResponse');
                        break;
                    } catch (e) {
                        console.log('[BringYourSub] Whisper: JSON parse failed');
                    }
                }
            }
        }

        if (!playerResponse) {
            console.log('[BringYourSub] Whisper: Could not extract player response');
            return null;
        }

        const streamingData = playerResponse.streamingData;
        if (!streamingData) {
            console.log('[BringYourSub] Whisper: No streaming data found');
            return null;
        }

        // Log what's available
        console.log('[BringYourSub] Whisper: streamingData keys:', Object.keys(streamingData));

        const adaptiveFormats = streamingData.adaptiveFormats || [];
        const formats = streamingData.formats || [];

        console.log('[BringYourSub] Whisper: adaptiveFormats count:', adaptiveFormats.length);
        console.log('[BringYourSub] Whisper: formats count:', formats.length);

        // Log first few formats for debugging
        if (adaptiveFormats.length > 0) {
            const sample = adaptiveFormats[0];
            console.log('[BringYourSub] Whisper: Sample format keys:', Object.keys(sample));
            console.log('[BringYourSub] Whisper: Has url?', !!sample.url);
            console.log('[BringYourSub] Whisper: Has signatureCipher?', !!sample.signatureCipher);
            console.log('[BringYourSub] Whisper: mimeType:', sample.mimeType);
        }

        // Find audio-only format - try both with direct URL and signatureCipher
        let audioFormats = (adaptiveFormats as AdaptiveFormat[])
            .filter(f => f.mimeType?.startsWith("audio/") && f.url)
            .sort((a, b) => {
                const sizeA = parseInt(a.contentLength || "0", 10);
                const sizeB = parseInt(b.contentLength || "0", 10);
                return sizeA - sizeB;
            });

        console.log('[BringYourSub] Whisper: Audio formats with direct URL:', audioFormats.length);

        // If no direct URLs, try to decode signatureCipher
        if (audioFormats.length === 0) {
            const cipherFormats = (adaptiveFormats as any[])
                .filter(f => f.mimeType?.startsWith("audio/") && f.signatureCipher);

            console.log('[BringYourSub] Whisper: Audio formats with signatureCipher:', cipherFormats.length);

            if (cipherFormats.length > 0) {
                // Try to extract URL from signatureCipher
                // signatureCipher format: "s=XXX&sp=sig&url=https://..."
                for (const format of cipherFormats) {
                    try {
                        const params = new URLSearchParams(format.signatureCipher);
                        const url = params.get('url');
                        // Note: This URL won't work without signature decryption
                        // but we can try - some videos work without it
                        if (url) {
                            format.url = url;
                            audioFormats.push(format);
                            console.log('[BringYourSub] Whisper: Extracted URL from cipher (may require decryption)');
                            break;
                        }
                    } catch (e) {
                        console.log('[BringYourSub] Whisper: Failed to parse signatureCipher');
                    }
                }
            }
        }

        // Still no luck? Try formats array (usually contains audio+video combined)
        if (audioFormats.length === 0 && formats.length > 0) {
            console.log('[BringYourSub] Whisper: Trying formats array...');
            const formatWithUrl = formats.find((f: any) => f.url);
            if (formatWithUrl) {
                console.log('[BringYourSub] Whisper: Found format with URL in formats array');
                audioFormats = [formatWithUrl];
            }
        }

        console.log('[BringYourSub] Whisper: Final audio formats count:', audioFormats.length);

        const audioFormat = audioFormats[0];
        if (!audioFormat?.url) {
            console.log('[BringYourSub] Whisper: No audio URL found');
            console.log('[BringYourSub] Whisper: YouTube may require signature decryption');
            return null;
        }

        const size = parseInt(audioFormat.contentLength || "0", 10);
        const duration = parseInt(audioFormat.approxDurationMs || "0", 10) / 1000;

        console.log('[BringYourSub] Whisper: Audio info - size:', size, 'duration:', duration);

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
