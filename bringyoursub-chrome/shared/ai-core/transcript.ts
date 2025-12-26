/**
 * YouTube Transcript Extraction Module
 * 
 * Handles extraction of native YouTube captions/transcripts
 * by parsing the YouTube player response data.
 * 
 * @module ai-core/transcript
 */

/** Individual transcript line with timing information */
export interface TranscriptLine {
    /** The text content of this line */
    text: string;
    /** Start time in seconds */
    start: number;
    /** Duration in seconds */
    duration: number;
}

/** YouTube player response caption track structure */
interface CaptionTrack {
    baseUrl: string;
    languageCode: string;
    name?: { simpleText: string };
}

/** YouTube transcript event segment */
interface TranscriptSegment {
    utf8: string;
}

/** YouTube transcript event */
interface TranscriptEvent {
    segs?: TranscriptSegment[];
}

/**
 * Fetches the native YouTube transcript for a video.
 * 
 * This function:
 * 1. Fetches the YouTube video page
 * 2. Extracts the ytInitialPlayerResponse JSON
 * 3. Finds available caption tracks (prefers English)
 * 4. Fetches and normalizes the transcript text
 * 
 * @param videoId - The YouTube video ID (e.g., "dQw4w9WgXcQ")
 * @returns The transcript text or null if unavailable
 * 
 * @example
 * ```typescript
 * const transcript = await getNativeYouTubeTranscript("dQw4w9WgXcQ");
 * if (transcript) {
 *     console.log("Got transcript:", transcript.substring(0, 100));
 * }
 * ```
 */
export async function getNativeYouTubeTranscript(videoId: string): Promise<string | null> {
    try {
        // Step 1: Fetch video page to find caption tracks
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const html = await response.text();

        // Step 2: Extract ytInitialPlayerResponse
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (!playerResponseMatch) return null;

        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const captions: CaptionTrack[] | undefined =
            playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (!captions || captions.length === 0) return null;

        // Step 3: Prefer English or first available track
        const track = captions.find((t) => t.languageCode === "en") || captions[0];
        const transcriptResponse = await fetch(track.baseUrl + "&fmt=json3");
        const transcriptData = await transcriptResponse.json();

        // Step 4: Normalize text (join segments, clean whitespace)
        const text = (transcriptData.events as TranscriptEvent[])
            .filter((e) => e.segs)
            .map((e) => e.segs!.map((s) => s.utf8).join(""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        return text || null;
    } catch (error) {
        console.error("[BringYourSub] Error fetching native transcript:", error);
        return null;
    }
}

/**
 * Extracts the YouTube video ID from the current page URL.
 * 
 * @returns The video ID or null if not on a YouTube video page
 * 
 * @example
 * ```typescript
 * // On https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * const videoId = getYouTubeVideoId(); // "dQw4w9WgXcQ"
 * ```
 */
export function getYouTubeVideoId(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
}

