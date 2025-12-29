/**
 * YouTube Transcript Extraction Module
 * 
 * Handles extraction of native YouTube captions/transcripts
 * using YouTube's internal Innertube API.
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
 * Fetches the native YouTube transcript for a video using multiple strategies.
 * 
 * Strategy 1: Fetch video page and use Innertube API
 * Strategy 2: Fall back to timedtext URL with srv3 format
 * 
 * @param videoId - The YouTube video ID (e.g., "dQw4w9WgXcQ")
 * @returns The transcript text or null if unavailable
 */
export async function getNativeYouTubeTranscript(videoId: string): Promise<string | null> {
    console.log('[BringYourSub] getNativeYouTubeTranscript called for:', videoId);

    // Strategy 1: Try Innertube API for transcript
    try {
        const innertubeResult = await fetchViaInnertube(videoId);
        if (innertubeResult) {
            console.log('[BringYourSub] Innertube transcript succeeded, length:', innertubeResult.length);
            return innertubeResult;
        }
    } catch (e) {
        console.log('[BringYourSub] Innertube approach failed:', e);
    }

    // Strategy 2: Try direct timedtext fetch with different formats
    try {
        const timedtextResult = await fetchViaTimedtext(videoId);
        if (timedtextResult) {
            console.log('[BringYourSub] Timedtext transcript succeeded, length:', timedtextResult.length);
            return timedtextResult;
        }
    } catch (e) {
        console.log('[BringYourSub] Timedtext approach failed:', e);
    }

    console.log('[BringYourSub] All transcript strategies failed');
    return null;
}

/**
 * Fetch transcript using YouTube's Innertube API
 */
async function fetchViaInnertube(videoId: string): Promise<string | null> {
    console.log('[BringYourSub] Trying Innertube API...');

    // First, get the video page to extract required tokens
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });
    const html = await pageResponse.text();
    console.log('[BringYourSub] Got video page, length:', html.length);

    // Extract ytInitialPlayerResponse
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
                    console.log('[BringYourSub] Parsed ytInitialPlayerResponse');
                    break;
                } catch (e) {
                    console.log('[BringYourSub] JSON parse failed');
                }
            }
        }
    }

    if (!playerResponse) {
        console.log('[BringYourSub] Could not extract player response');
        return null;
    }

    // Check for captions
    const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks as CaptionTrack[] | undefined;

    if (!captions || captions.length === 0) {
        console.log('[BringYourSub] No captions in player response');
        return null;
    }

    console.log('[BringYourSub] Found captions:', captions.map(c => c.languageCode).join(', '));

    // Prefer English track
    const track = captions.find(t => t.languageCode === 'en') || captions[0];

    // Try fetching with srv3 format (JSON format)
    const captionUrl = track.baseUrl + '&fmt=srv3';
    console.log('[BringYourSub] Fetching captions with srv3 format...');

    const captionResponse = await fetch(captionUrl, {
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`
        }
    });

    const captionText = await captionResponse.text();
    console.log('[BringYourSub] Caption response length:', captionText.length);

    if (!captionText || captionText.length === 0) {
        // Try without format parameter (default XML)
        console.log('[BringYourSub] srv3 failed, trying default format...');
        const defaultResponse = await fetch(track.baseUrl, {
            headers: {
                'Accept': 'text/xml, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `https://www.youtube.com/watch?v=${videoId}`
            }
        });
        const defaultText = await defaultResponse.text();
        console.log('[BringYourSub] Default format response length:', defaultText.length);

        if (defaultText && defaultText.length > 0) {
            return parseTranscriptResponse(defaultText);
        }
        return null;
    }

    return parseTranscriptResponse(captionText);
}

/**
 * Fetch transcript using timedtext URL with various format parameters
 */
async function fetchViaTimedtext(videoId: string): Promise<string | null> {
    console.log('[BringYourSub] Trying timedtext API...');

    // Try different timedtext URL formats
    const formats = ['srv3', 'json3', 'srv1', ''];

    for (const fmt of formats) {
        try {
            const fmtParam = fmt ? `&fmt=${fmt}` : '';
            const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&name=${fmtParam}`;

            console.log('[BringYourSub] Trying timedtext format:', fmt || 'default');

            const response = await fetch(url, {
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const text = await response.text();

            if (text && text.length > 0) {
                console.log('[BringYourSub] Got timedtext response, length:', text.length);
                return parseTranscriptResponse(text);
            }
        } catch (e) {
            console.log('[BringYourSub] Timedtext format', fmt, 'failed:', e);
        }
    }

    return null;
}

/**
 * Parse transcript response (XML or JSON format)
 */
function parseTranscriptResponse(responseText: string): string | null {
    const trimmed = responseText.trim();

    if (trimmed.startsWith('<')) {
        // Parse XML format
        console.log('[BringYourSub] Parsing XML transcript...');
        const textMatches = responseText.match(/<text[^>]*>([^<]*)<\/text>/g) || [];

        if (textMatches.length === 0) {
            // Try alternative XML format
            const altMatches = responseText.match(/<[^>]+>([^<]+)<\/[^>]+>/g) || [];
            if (altMatches.length > 0) {
                const text = altMatches
                    .map(match => {
                        const content = match.replace(/<[^>]+>/g, '');
                        return decodeHtmlEntities(content);
                    })
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                return text || null;
            }
            return null;
        }

        const text = textMatches
            .map(match => {
                const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
                return decodeHtmlEntities(content);
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log('[BringYourSub] Parsed XML transcript, length:', text.length);
        return text || null;

    } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // Parse JSON format
        console.log('[BringYourSub] Parsing JSON transcript...');
        try {
            const data = JSON.parse(responseText);

            // Handle srv3 format
            if (data.events) {
                const text = (data.events as TranscriptEvent[])
                    .filter((e) => e.segs)
                    .map((e) => e.segs!.map((s) => s.utf8).join(''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                console.log('[BringYourSub] Parsed JSON transcript, length:', text.length);
                return text || null;
            }

            // Handle other JSON formats
            if (Array.isArray(data)) {
                const text = data
                    .filter((item: any) => item.text || item.utf8)
                    .map((item: any) => item.text || item.utf8)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                return text || null;
            }

        } catch (e) {
            console.error('[BringYourSub] JSON parse error:', e);
        }
    }

    console.log('[BringYourSub] Unknown transcript format');
    return null;
}

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/\n/g, ' ');
}

/**
 * Extracts the YouTube video ID from the current page URL.
 * 
 * @returns The video ID or null if not on a YouTube video page
 */
export function getYouTubeVideoId(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("v");
}
