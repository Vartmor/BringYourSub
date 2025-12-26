/**
 * Whisper Transcription Fallback Module
 * 
 * Provides audio transcription via OpenAI's Whisper API
 * for videos that don't have native YouTube captions.
 * 
 * @module ai-core/whisper
 */

/** Whisper API response structure */
interface WhisperResponse {
    text: string;
    error?: {
        message: string;
    };
}

/** YouTube adaptive stream format */
interface AdaptiveFormat {
    mimeType: string;
    url?: string;
}

/**
 * Transcribes a YouTube video using OpenAI's Whisper API.
 * 
 * This function:
 * 1. Extracts the audio stream URL from YouTube
 * 2. Downloads the audio content
 * 3. Sends it to Whisper for transcription
 * 
 * @param videoId - The YouTube video ID
 * @param apiKey - OpenAI API key for Whisper access
 * @returns Transcribed text or null if transcription fails
 * 
 * @remarks
 * - Whisper has a 25MB file size limit
 * - This may hit CORS issues outside of extension context
 * - Longer videos may need chunked processing (not yet implemented)
 * 
 * @example
 * ```typescript
 * const transcript = await getWhisperTranscript("dQw4w9WgXcQ", "sk-...");
 * if (transcript) {
 *     console.log("Whisper transcript:", transcript);
 * }
 * ```
 */
export async function getWhisperTranscript(
    videoId: string,
    apiKey: string
): Promise<string | null> {
    try {
        // Step 1: Get audio stream URL
        const audioUrl = await getYouTubeAudioUrl(videoId);
        if (!audioUrl) {
            throw new Error("Could not extract audio URL from YouTube");
        }

        // Step 2: Download audio content
        // Note: Whisper has a 25MB limit. For v1, we fetch the whole file.
        const audioResponse = await fetch(audioUrl);
        const audioBlob = await audioResponse.blob();

        // Step 3: Send to Whisper API
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.mp4");
        formData.append("model", "whisper-1");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const error: WhisperResponse = await response.json();
            throw new Error(error.error?.message || "Whisper API request failed");
        }

        const data: WhisperResponse = await response.json();
        return data.text;
    } catch (error) {
        console.error("[BringYourSub] Whisper fallback error:", error);
        return null;
    }
}

/**
 * Extracts an audio-only stream URL from a YouTube video.
 * 
 * Parses the ytInitialPlayerResponse to find adaptive formats
 * and selects an audio-only stream (MP4 or WebM).
 * 
 * @param videoId - The YouTube video ID
 * @returns Audio stream URL or null if not found
 * @internal
 */
async function getYouTubeAudioUrl(videoId: string): Promise<string | null> {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();

    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerResponseMatch) return null;

    const playerResponse = JSON.parse(playerResponseMatch[1]);
    const streamingData = playerResponse.streamingData;
    if (!streamingData?.adaptiveFormats) return null;

    // Find an audio-only format (prefer MP4, then WebM)
    const audioFormat = (streamingData.adaptiveFormats as AdaptiveFormat[]).find(
        (f) => f.mimeType.startsWith("audio/mp4") || f.mimeType.startsWith("audio/webm")
    );

    return audioFormat?.url || null;
}

