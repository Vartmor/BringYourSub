/**
 * BringYourSub - YouTube Content Script
 *
 * Runs on YouTube video pages to:
 * - Extract video metadata
 * - Display custom subtitle overlay
 * - Sync subtitles with video playback
 *
 * @module content/youtube
 */

console.log('[BringYourSub] Content script active on YouTube');

// =====================
// Types
// =====================
interface VideoMetadata {
    title: string;
    channel: string;
}

interface SubtitleCue {
    start: number;
    end: number;
    text: string;
}

interface SubtitleMessage {
    action: string;
    subtitles?: string;
    fontSize?: string;
    position?: string;
}

// =====================
// Subtitle Overlay
// =====================
class SubtitleOverlay {
    private container: HTMLDivElement | null = null;
    private textElement: HTMLDivElement | null = null;
    private cues: SubtitleCue[] = [];
    private video: HTMLVideoElement | null = null;
    private animationFrame: number | null = null;
    public isActive = false;
    private fontSize = 'medium';
    private position = 'bottom';
    private rawSubtitles: string = ''; // Store raw SRT for persistence

    private readonly fontSizes: Record<string, string> = {
        small: '14px',
        medium: '18px',
        large: '24px',
        xlarge: '32px'
    };

    /**
     * Initialize the overlay on the video player
     */
    init(): void {
        this.video = document.querySelector('video');
        if (!this.video) {
            console.error('[BringYourSub] No video element found');
            return;
        }

        this.createOverlay();
        this.bindEvents();
        this.restoreSubtitles(); // Restore saved subtitles for this video
    }

    /**
     * Get current video ID from URL
     */
    private getVideoId(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('v');
    }

    /**
     * Save subtitles to storage for current video
     * Uses window.sessionStorage which works in content scripts
     */
    private saveSubtitles(): void {
        const videoId = this.getVideoId();
        if (!videoId || !this.rawSubtitles) return;

        try {
            const key = `bys_subtitles_${videoId}`;
            const data = JSON.stringify({
                subtitles: this.rawSubtitles,
                fontSize: this.fontSize,
                position: this.position,
                timestamp: Date.now()
            });
            window.sessionStorage.setItem(key, data);
            console.log('[BringYourSub] Saved subtitles to storage for video:', videoId);
        } catch (e) {
            console.error('[BringYourSub] Failed to save subtitles:', e);
        }
    }

    /**
     * Restore subtitles from storage for current video
     */
    private restoreSubtitles(): void {
        const videoId = this.getVideoId();
        if (!videoId) return;

        try {
            const key = `bys_subtitles_${videoId}`;
            const stored = window.sessionStorage.getItem(key);

            if (stored) {
                const saved = JSON.parse(stored);
                if (saved && saved.subtitles) {
                    console.log('[BringYourSub] Restoring saved subtitles for video:', videoId);
                    this.apply(saved.subtitles, saved.fontSize, saved.position, false); // false = don't re-save
                }
            }
        } catch (e) {
            console.error('[BringYourSub] Failed to restore subtitles:', e);
        }
    }

    /**
     * Clear saved subtitles for current video
     */
    private clearSavedSubtitles(): void {
        const videoId = this.getVideoId();
        if (!videoId) return;

        try {
            const key = `bys_subtitles_${videoId}`;
            window.sessionStorage.removeItem(key);
            console.log('[BringYourSub] Cleared saved subtitles for video:', videoId);
        } catch (e) {
            console.error('[BringYourSub] Failed to clear saved subtitles:', e);
        }
    }

    /**
     * Create the subtitle overlay container
     */
    private createOverlay(): void {
        // Stop any existing sync loop (it would reference old DOM elements)
        this.stopSync();

        // Remove existing overlay element only (don't clear cues)
        const existing = document.getElementById('bys-subtitle-overlay');
        if (existing) existing.remove();

        // Use #movie_player or .html5-video-player - these don't have overflow:hidden
        // .html5-video-container has overflow:hidden which clips our overlay
        let container = document.getElementById('movie_player') ||
            document.querySelector('.html5-video-player');

        if (!container) {
            console.error('[BringYourSub] No video player container found for overlay');
            return;
        }

        this.createOverlayInContainer(container as HTMLElement);
    }

    /**
     * Create overlay in a specific container
     */
    private createOverlayInContainer(container: HTMLElement): void {
        this.container = document.createElement('div');
        this.container.id = 'bys-subtitle-overlay';
        this.container.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 80px !important;
            z-index: 9999 !important;
            display: flex !important;
            justify-content: center !important;
            pointer-events: none !important;
            visibility: visible !important;
        `;

        this.textElement = document.createElement('div');
        this.textElement.id = 'bys-subtitle-text';
        this.textElement.style.cssText = `
            background: rgba(0, 0, 0, 0.85) !important;
            color: #ffffff !important;
            padding: 10px 20px !important;
            border-radius: 6px !important;
            font-family: 'YouTube Noto', Roboto, Arial, sans-serif !important;
            text-align: center !important;
            max-width: 80% !important;
            line-height: 1.4 !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
            font-size: 18px !important;
            font-weight: 500 !important;
            visibility: visible !important;
            display: inline-block !important;
        `;
        this.updateFontSize();

        this.container.appendChild(this.textElement);
        container.appendChild(this.container);
        console.log('[BringYourSub] Created subtitle overlay, parent:', container.className);
    }

    /**
     * Update subtitle position
     */
    private updatePosition(): void {
        if (!this.container) return;

        if (this.position === 'top') {
            this.container.style.top = '40px';
            this.container.style.bottom = 'auto';
        } else {
            this.container.style.bottom = '80px';
            this.container.style.top = 'auto';
        }
    }

    /**
     * Update font size
     */
    private updateFontSize(): void {
        if (!this.textElement) return;
        this.textElement.style.fontSize = this.fontSizes[this.fontSize] || this.fontSizes.medium;
    }

    /**
     * Bind video events
     */
    private bindEvents(): void {
        if (!this.video) return;

        // Start sync loop when playing
        this.video.addEventListener('play', () => this.startSync());
        this.video.addEventListener('playing', () => this.startSync());

        // Stop sync when paused/ended
        this.video.addEventListener('pause', () => this.stopSync());
        this.video.addEventListener('ended', () => this.stopSync());

        // Handle seeking
        this.video.addEventListener('seeked', () => this.updateSubtitle());
    }

    /**
     * Parse SRT format subtitles
     */
    parseSRT(srtText: string): SubtitleCue[] {
        const cues: SubtitleCue[] = [];

        // Try to parse as SRT format
        const srtPattern = /(\d+)\s*\n(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*\n([\s\S]*?)(?=\n\n|\n*$)/g;
        let match;

        while ((match = srtPattern.exec(srtText)) !== null) {
            const start = this.parseTimestamp(match[2]);
            const end = this.parseTimestamp(match[3]);
            const text = match[4].trim().replace(/\n/g, ' ');

            cues.push({ start, end, text });
        }

        // If no SRT cues found, try simple line-by-line with generated timings
        if (cues.length === 0) {
            const lines = srtText.split('\n').filter(line => line.trim());
            const duration = this.video?.duration || 300;
            const timePerLine = duration / lines.length;

            lines.forEach((line, index) => {
                cues.push({
                    start: index * timePerLine,
                    end: (index + 1) * timePerLine,
                    text: line.trim()
                });
            });
        }

        return cues;
    }

    /**
     * Parse SRT timestamp to seconds
     */
    private parseTimestamp(timestamp: string): number {
        const parts = timestamp.replace(',', '.').split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseFloat(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Apply subtitles from text
     * @param subtitles - SRT format subtitle text
     * @param fontSize - Font size setting
     * @param position - Position setting (top/bottom)
     * @param shouldSave - Whether to save to storage (default true)
     */
    apply(subtitles: string, fontSize?: string, position?: string, shouldSave: boolean = true): void {
        console.log('[BringYourSub] apply() called with', subtitles.length, 'chars');

        // Ensure video element exists
        if (!this.video) {
            this.video = document.querySelector('video');
            if (!this.video) {
                console.error('[BringYourSub] No video element found, cannot apply subtitles');
                return;
            }
        }

        if (fontSize) {
            this.fontSize = fontSize;
        }
        if (position) {
            this.position = position;
        }

        this.rawSubtitles = subtitles; // Store raw text for persistence
        this.cues = this.parseSRT(subtitles);
        console.log('[BringYourSub] Parsed', this.cues.length, 'cues');

        this.isActive = true;

        // Ensure overlay exists (this won't clear cues anymore)
        if (!this.container || !document.getElementById('bys-subtitle-overlay')) {
            this.createOverlay();
        }

        // Update font size and position after overlay is created
        this.updateFontSize();
        this.updatePosition();

        // Hide YouTube's native captions
        this.hideNativeCaptions();

        // Stop any existing sync (in case overlay was recreated with new DOM elements)
        this.stopSync();

        // Start syncing with fresh references
        this.startSync();

        // Save to storage for persistence (unless explicitly disabled)
        if (shouldSave) {
            this.saveSubtitles();
        }

        console.log(`[BringYourSub] Applied ${this.cues.length} subtitle cues, sync started`);
    }

    /**
     * Hide YouTube's native caption display
     */
    private hideNativeCaptions(): void {
        const nativeCaptions = document.querySelector('.ytp-caption-window-container');
        if (nativeCaptions) {
            (nativeCaptions as HTMLElement).style.display = 'none';
        }

        // Try to turn off captions via button
        const ccButton = document.querySelector('.ytp-subtitles-button[aria-pressed="true"]');
        if (ccButton) {
            (ccButton as HTMLElement).click();
        }
    }

    /**
     * Show YouTube's native captions
     */
    private showNativeCaptions(): void {
        const nativeCaptions = document.querySelector('.ytp-caption-window-container');
        if (nativeCaptions) {
            (nativeCaptions as HTMLElement).style.display = '';
        }
    }

    /**
     * Start subtitle sync loop
     */
    private startSync(): void {
        if (!this.isActive || this.animationFrame !== null) return;

        // Verify overlay is in DOM
        const overlayInDom = document.getElementById('bys-subtitle-overlay');
        const textInDom = document.getElementById('bys-subtitle-text');
        console.log('[BringYourSub] startSync: overlay in DOM:', !!overlayInDom, 'text in DOM:', !!textInDom);
        console.log('[BringYourSub] startSync: this.textElement valid:', !!this.textElement, 'this.video valid:', !!this.video);
        console.log('[BringYourSub] startSync: cues count:', this.cues.length, 'first cue:', this.cues[0]);

        let logCounter = 0;
        const sync = (): void => {
            this.updateSubtitle(logCounter < 5); // Log first 5 times
            logCounter++;
            this.animationFrame = requestAnimationFrame(sync);
        };
        sync();
    }

    /**
     * Stop subtitle sync loop
     */
    private stopSync(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Update displayed subtitle based on current time
     */
    private updateSubtitle(shouldLog: boolean = false): void {
        if (!this.video || !this.textElement || !this.isActive) {
            if (shouldLog) {
                console.log('[BringYourSub] updateSubtitle skip: video:', !!this.video, 'textElement:', !!this.textElement, 'isActive:', this.isActive);
            }
            return;
        }

        const currentTime = this.video.currentTime;
        const currentCue = this.cues.find(
            cue => currentTime >= cue.start && currentTime <= cue.end
        );

        if (shouldLog) {
            console.log('[BringYourSub] updateSubtitle: time:', currentTime.toFixed(2), 'cue found:', !!currentCue, 'text:', currentCue?.text?.substring(0, 50));
        }

        if (currentCue) {
            this.textElement.textContent = currentCue.text;
            this.textElement.style.display = 'inline-block';
            this.textElement.style.visibility = 'visible';
        } else {
            this.textElement.textContent = '';
            this.textElement.style.display = 'none';
        }
    }

    /**
     * Toggle subtitle visibility
     */
    toggle(): void {
        this.isActive = !this.isActive;

        if (this.container) {
            this.container.style.display = this.isActive ? 'flex' : 'none';
        }

        if (this.isActive) {
            this.hideNativeCaptions();
            this.startSync();
        } else {
            this.showNativeCaptions();
            this.stopSync();
        }
    }

    /**
     * Check if subtitles have been loaded
     */
    hasCues(): boolean {
        return this.cues.length > 0;
    }

    /**
     * Remove the overlay and clear saved subtitles
     */
    destroy(): void {
        this.stopSync();
        this.isActive = false;

        const existing = document.getElementById('bys-subtitle-overlay');
        if (existing) existing.remove();

        this.showNativeCaptions();
        this.cues = [];
        this.rawSubtitles = '';
        this.clearSavedSubtitles(); // Also clear from storage
    }
}

// =====================
// Singleton Instance
// =====================
const subtitleOverlay = new SubtitleOverlay();

// =====================
// Message Handling
// =====================
try {
    chrome.runtime.onMessage.addListener((
        message: SubtitleMessage & { action: string },
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: any) => void
    ): boolean | void => {

        if (message.action === 'GET_METADATA') {
            const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || 'Unknown';
            const channel = document.querySelector('ytd-channel-name #text')?.textContent?.trim() || 'Unknown';
            sendResponse({ title, channel });
            return true;
        }

        if (message.action === 'GET_TRANSCRIPT') {
            extractTranscript().then(transcript => {
                sendResponse({ transcript });
            }).catch(() => {
                sendResponse({ transcript: null });
            });
            return true; // Keep channel open for async
        }

        if (message.action === 'APPLY_SUBTITLES') {
            if (message.subtitles) {
                subtitleOverlay.apply(message.subtitles, message.fontSize, message.position);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false });
            }
            return true;
        }

        if (message.action === 'TOGGLE_SUBTITLES') {
            subtitleOverlay.toggle();
            sendResponse({ success: true });
            return true;
        }

        if (message.action === 'REMOVE_SUBTITLES') {
            subtitleOverlay.destroy();
            sendResponse({ success: true });
            return true;
        }
    });
    console.log('[BringYourSub] Message listener registered');
} catch (e) {
    console.error('[BringYourSub] Failed to register message listener:', e);
}

// =====================
// YouTube Player Button
// =====================
function injectPlayerButton(): void {
    try {
        // Check if button already exists
        if (document.getElementById('bys-player-btn')) return;

        // Find the right controls container
        const rightControls = document.querySelector('.ytp-right-controls');
        if (!rightControls) {
            console.log('[BringYourSub] Controls not found, skipping button injection');
            return;
        }

        // Create the button
        const button = document.createElement('button');
        button.id = 'bys-player-btn';
        button.className = 'ytp-button';
        button.title = 'BringYourSub - Toggle Translated Subtitles';
        button.innerHTML = `
            <svg height="100%" viewBox="0 0 36 36" width="100%">
                <!-- Speech bubble -->
                <path d="M8 10c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-4l-4 4-4-4h-4c-1.1 0-2-.9-2-2V10z" 
                      fill="none" stroke="#fff" stroke-width="1.5"/>
                <!-- A character (English) -->
                <text x="13" y="19" fill="#fff" font-size="9" font-weight="bold" font-family="Arial">A</text>
                <!-- Arrow -->
                <text x="18" y="18" fill="#fff" font-size="6" font-family="Arial">→</text>
                <!-- 文 character (represents translation) -->
                <text x="24" y="19" fill="#fff" font-size="8" font-family="Arial">文</text>
            </svg>
        `;
        button.style.cssText = `
            position: relative;
            cursor: pointer;
            opacity: 0.9;
            transition: opacity 0.2s;
        `;

        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.opacity = '1';
        });
        button.addEventListener('mouseleave', () => {
            button.style.opacity = '0.9';
        });

        // Click handler - toggle subtitles or show status
        button.addEventListener('click', (e) => {
            e.stopPropagation();

            if (subtitleOverlay.isActive) {
                subtitleOverlay.toggle();
                showPlayerToast('Subtitles hidden');
            } else if (subtitleOverlay.hasCues()) {
                subtitleOverlay.toggle();
                showPlayerToast('Subtitles shown');
            } else {
                showPlayerToast('Open extension popup to generate subtitles');
            }
        });

        // Insert before the settings button
        const settingsBtn = rightControls.querySelector('.ytp-settings-button');
        if (settingsBtn && settingsBtn.parentNode === rightControls) {
            rightControls.insertBefore(button, settingsBtn);
        } else {
            rightControls.appendChild(button);
        }

        console.log('[BringYourSub] Player button injected');
    } catch (e) {
        console.error('[BringYourSub] Failed to inject player button', e);
    }
}

// Show a toast message on the video player
function showPlayerToast(message: string): void {
    try {
        // Remove existing toast
        const existing = document.getElementById('bys-player-toast');
        if (existing) existing.remove();

        const player = document.querySelector('.html5-video-player');
        if (!player) return;

        const toast = document.createElement('div');
        toast.id = 'bys-player-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 100;
            animation: bys-toast-fade 2s forwards;
        `;

        // Add animation style if not exists
        if (!document.getElementById('bys-toast-style')) {
            const style = document.createElement('style');
            style.id = 'bys-toast-style';
            style.textContent = `
                @keyframes bys-toast-fade {
                    0% { opacity: 1; }
                    70% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        player.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    } catch (e) {
        console.error('[BringYourSub] Toast failed:', e);
    }
}

// Initialize when video container is available
function initOverlay(): void {
    const videoContainer = document.querySelector('.html5-video-container');
    if (videoContainer) {
        subtitleOverlay.init();
        injectPlayerButton();
    }
}

// =====================
// Transcript Extraction (Main World Injection)
// =====================

/**
 * Extracts a JSON object from a string by finding balanced braces.
 * Much more reliable than regex for nested JSON.
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
 * Strategy 3: Extract transcript directly from YouTube's transcript panel DOM
 * This bypasses all URL fetch issues by reading the transcript from the page itself
 */
async function extractFromTranscriptPanel(): Promise<string | null> {
    console.log('[BringYourSub] Strategy 3: Extracting from transcript panel...');

    try {
        // First, check if transcript panel is already open
        let transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');

        if (!transcriptPanel) {
            console.log('[BringYourSub] Opening transcript panel...');

            // Try to find and click the "Show transcript" button in the description
            // First, expand the description if needed
            const expandButton = document.querySelector('tp-yt-paper-button#expand') as HTMLElement;
            if (expandButton) {
                expandButton.click();
                await sleep(500);
            }

            // Look for the transcript button in the engagement panels
            const moreActionsButton = document.querySelector('button[aria-label="More actions"], #button-shape button') as HTMLElement;
            if (moreActionsButton) {
                moreActionsButton.click();
                await sleep(300);

                // Look for "Show transcript" option
                const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
                for (const item of menuItems) {
                    const text = item.textContent?.toLowerCase() || '';
                    if (text.includes('transcript') || text.includes('transkript')) {
                        (item as HTMLElement).click();
                        await sleep(1000);
                        break;
                    }
                }
            }

            // Alternative: Try to click on the transcript button directly in the video description
            const descriptionTranscriptBtn = document.querySelector('ytd-video-description-transcript-section-renderer button') as HTMLElement;
            if (descriptionTranscriptBtn) {
                descriptionTranscriptBtn.click();
                await sleep(1000);
            }

            // Wait for transcript panel to appear
            await sleep(500);
            transcriptPanel = document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        }

        if (!transcriptPanel) {
            console.log('[BringYourSub] Transcript panel not found');
            return null;
        }

        console.log('[BringYourSub] Found transcript panel, extracting text...');
        console.log('[BringYourSub] Panel element:', transcriptPanel.tagName, transcriptPanel.className);

        // Wait for transcript content to load - poll for segment renderers
        // Segments load dynamically after the panel opens
        let segments: NodeListOf<Element> | null = null;
        const maxWaitTime = 3000; // 3 seconds max
        const pollInterval = 300;
        let elapsed = 0;

        while (elapsed < maxWaitTime) {
            // Look for ytd-transcript-renderer inside the panel (the actual transcript content)
            let transcriptRenderer = transcriptPanel.querySelector('ytd-transcript-renderer');
            const searchTarget = transcriptRenderer || transcriptPanel;

            // Try to find segments - YouTube uses ytd-transcript-segment-renderer
            segments = searchTarget.querySelectorAll('ytd-transcript-segment-renderer');

            if (segments.length > 0) {
                console.log('[BringYourSub] Found', segments.length, 'transcript segments after', elapsed, 'ms');
                break;
            }

            // Also try the segment-list-renderer
            const segmentList = searchTarget.querySelector('ytd-transcript-segment-list-renderer');
            if (segmentList) {
                segments = segmentList.querySelectorAll('ytd-transcript-segment-renderer');
                if (segments.length > 0) {
                    console.log('[BringYourSub] Found', segments.length, 'segments in segment-list after', elapsed, 'ms');
                    break;
                }
            }

            // Log progress on first iteration
            if (elapsed === 0) {
                console.log('[BringYourSub] Waiting for segments to load...');
            }

            await sleep(pollInterval);
            elapsed += pollInterval;
        }

        if (!segments || segments.length === 0) {
            console.log('[BringYourSub] No transcript segments found after', elapsed, 'ms');

            // Log the panel structure for debugging
            const transcriptRenderer = transcriptPanel.querySelector('ytd-transcript-renderer');
            if (transcriptRenderer) {
                console.log('[BringYourSub] ytd-transcript-renderer found, elements:', transcriptRenderer.querySelectorAll('*').length);
                const uniqueTags = new Set(Array.from(transcriptRenderer.querySelectorAll('*')).map(el => el.tagName.toLowerCase()));
                console.log('[BringYourSub] Unique tags:', Array.from(uniqueTags).slice(0, 15));
            } else {
                // Check what's directly in the panel
                const allElements = transcriptPanel.querySelectorAll('*');
                console.log('[BringYourSub] No ytd-transcript-renderer, total elements:', allElements.length);
            }

            console.log('[BringYourSub] No transcript segments found in panel');
            return null;
        }

        const transcriptText = Array.from(segments)
            .map(seg => {
                // Get just the text content, excluding timestamps
                const textElement = seg.querySelector('yt-formatted-string.segment-text, .segment-text') || seg;
                return textElement.textContent?.trim() || '';
            })
            .filter(t => t.length > 0 && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) // Filter out timestamps
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (transcriptText.length > 0) {
            console.log('[BringYourSub] Extracted transcript from DOM, length:', transcriptText.length);
            return transcriptText;
        }

        return null;
    } catch (e) {
        console.error('[BringYourSub] DOM transcript extraction failed:', e);
        return null;
    }
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strategy 1: Extract ytInitialPlayerResponse from script tags using balanced brace matching
 */
function extractFromScriptTags(): any | null {
    console.log('[BringYourSub] Strategy 1: Extracting from script tags...');
    const scripts = document.querySelectorAll('script');

    for (const script of scripts) {
        const content = script.textContent || '';

        // Look for ytInitialPlayerResponse assignment
        const patterns = [
            /ytInitialPlayerResponse\s*=\s*/,
            /var\s+ytInitialPlayerResponse\s*=\s*/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match.index !== undefined) {
                const startIdx = match.index + match[0].length;
                const jsonStr = extractJsonObject(content, startIdx);

                if (jsonStr) {
                    try {
                        const parsed = JSON.parse(jsonStr);
                        console.log('[BringYourSub] Successfully parsed ytInitialPlayerResponse from script tag');
                        return parsed;
                    } catch (e) {
                        console.log('[BringYourSub] JSON parse failed for this script, trying next...', e);
                    }
                }
            }
        }
    }

    console.log('[BringYourSub] Strategy 1 failed: No valid ytInitialPlayerResponse found in script tags');
    return null;
}

/**
 * Strategy 2: Request ytInitialPlayerResponse from the injected main world script
 */
async function extractFromMainWorld(): Promise<any | null> {
    console.log('[BringYourSub] Strategy 2: Requesting from main world...');
    const requestId = 'player_response_' + Date.now().toString() + Math.random().toString();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('message', listener);
            console.log('[BringYourSub] Strategy 2 failed: Timeout waiting for main world response');
            resolve(null);
        }, 5000);

        const listener = (event: MessageEvent) => {
            if (event.data?.requestId === requestId && event.data?.type === 'BYS_PLAYER_RESPONSE') {
                clearTimeout(timeout);
                window.removeEventListener('message', listener);
                if (event.data.playerResponse) {
                    console.log('[BringYourSub] Successfully got ytInitialPlayerResponse from main world');
                    resolve(event.data.playerResponse);
                } else {
                    console.log('[BringYourSub] Strategy 2 failed: Main world returned null');
                    resolve(null);
                }
            }
        };

        window.addEventListener('message', listener);
        window.postMessage({ type: 'BYS_GET_PLAYER_RESPONSE', requestId }, '*');
    });
}

/**
 * Strategy 0: Extract captions directly from YouTube's internal player API
 * This accesses data already loaded in memory via the injected script
 */
async function extractFromPlayerAPI(): Promise<string | null> {
    console.log('[BringYourSub] Strategy 0: Extracting from player API...');
    const requestId = 'player_captions_' + Date.now().toString() + Math.random().toString();

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            window.removeEventListener('message', listener);
            console.log('[BringYourSub] Strategy 0 failed: Timeout waiting for player API response');
            resolve(null);
        }, 5000);

        const listener = (event: MessageEvent) => {
            if (event.data?.requestId === requestId && event.data?.type === 'BYS_CAPTIONS_RESULT') {
                clearTimeout(timeout);
                window.removeEventListener('message', listener);
                if (event.data.captionText && event.data.captionText.length > 0) {
                    console.log('[BringYourSub] Strategy 0 succeeded, caption length:', event.data.captionText.length);
                    resolve(event.data.captionText);
                } else {
                    console.log('[BringYourSub] Strategy 0 failed: No caption text returned');
                    resolve(null);
                }
            }
        };

        window.addEventListener('message', listener);
        window.postMessage({ type: 'BYS_GET_CAPTIONS_FROM_PLAYER', requestId }, '*');
    });
}

/**
 * Main transcript extraction function with multiple fallback strategies
 */
async function extractTranscript(): Promise<string | null> {
    console.log('[BringYourSub] extractTranscript called');

    try {
        // Strategy 0 (NEW): Try extracting from YouTube's internal player API via injected script
        // This accesses ytInitialData and player API which may have caption data in memory
        console.log('[BringYourSub] Strategy 0: Trying player API extraction...');
        const playerCaptions = await extractFromPlayerAPI();
        if (playerCaptions && playerCaptions.length > 100) {
            console.log('[BringYourSub] Player API extraction succeeded with length:', playerCaptions.length);
            return playerCaptions;
        }

        // Strategy 3: Try extracting from transcript panel DOM
        // This is the most reliable as it bypasses all URL fetch issues
        console.log('[BringYourSub] Trying DOM extraction...');
        const domTranscript = await extractFromTranscriptPanel();
        if (domTranscript && domTranscript.length > 100) {
            console.log('[BringYourSub] DOM extraction succeeded with length:', domTranscript.length);
            return domTranscript;
        }

        // Strategy 1: Extract from script tags and fetch caption URL
        let playerResponse: any = null;
        playerResponse = extractFromScriptTags();

        // Strategy 2: Request from main world (fallback)
        if (!playerResponse) {
            playerResponse = await extractFromMainWorld();
        }

        if (!playerResponse) {
            console.error('[BringYourSub] All extraction strategies failed');
            return null;
        }

        // Extract caption tracks
        const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captions || captions.length === 0) {
            console.log('[BringYourSub] No captions available in player response');
            console.log('[BringYourSub] Available keys:', Object.keys(playerResponse));
            if (playerResponse.captions) {
                console.log('[BringYourSub] Captions object:', JSON.stringify(playerResponse.captions).substring(0, 500));
            }
            return null;
        }

        console.log('[BringYourSub] Found', captions.length, 'caption track(s):',
            captions.map((t: any) => t.languageCode).join(', '));

        // Prefer English or first track
        const track = captions.find((t: any) => t.languageCode === 'en') || captions[0];
        const fetchUrl = track.baseUrl;

        console.log('[BringYourSub] Selected track:', track.languageCode, 'URL:', fetchUrl?.substring(0, 100) + '...');

        if (!fetchUrl) {
            console.error('[BringYourSub] No baseUrl found for caption track');
            return null;
        }

        // Fetch transcript via injected script in main world (has access to page cookies)
        console.log('[BringYourSub] Requesting transcript fetch from injected script...');
        const requestId = 'fetch_' + Date.now().toString() + Math.random().toString();

        const responseText = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                window.removeEventListener('message', listener);
                reject(new Error('Fetch timeout after 30 seconds'));
            }, 30000);

            const listener = (event: MessageEvent) => {
                if (event.data?.requestId === requestId) {
                    window.removeEventListener('message', listener);
                    clearTimeout(timeout);

                    if (event.data.type === 'BYS_FETCH_SUCCESS') {
                        console.log('[BringYourSub] Injected fetch succeeded, length:', event.data.text?.length);
                        resolve(event.data.text);
                    } else if (event.data.type === 'BYS_FETCH_ERROR') {
                        console.error('[BringYourSub] Injected fetch failed:', event.data.error);
                        reject(new Error(event.data.error));
                    }
                }
            };

            window.addEventListener('message', listener);

            // Send request to injected script
            window.postMessage({
                type: 'BYS_FETCH_REQUEST',
                url: fetchUrl,
                requestId: requestId
            }, '*');
        });

        if (!responseText) {
            console.error('[BringYourSub] Empty response from transcript fetch');
            return null;
        }

        console.log('[BringYourSub] Got transcript response, length:', responseText.length);
        console.log('[BringYourSub] Response preview:', responseText.substring(0, 200));

        // Parse the response (XML or JSON format)
        try {
            // XML format (default from YouTube without fmt=json3)
            if (responseText.trim().startsWith('<')) {
                console.log('[BringYourSub] Parsing XML transcript...');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(responseText, "text/xml");

                // Check for parse errors
                const parseError = xmlDoc.querySelector('parsererror');
                if (parseError) {
                    console.error('[BringYourSub] XML parse error:', parseError.textContent);
                    return null;
                }

                const texts = Array.from(xmlDoc.getElementsByTagName("text"));
                console.log('[BringYourSub] Found', texts.length, 'text elements in XML');

                const transcriptText = texts
                    .map(node => {
                        // Decode HTML entities
                        const text = node.textContent || '';
                        const decoded = text
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/\n/g, ' ');
                        return decoded;
                    })
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                console.log('[BringYourSub] XML transcript parsed successfully, length:', transcriptText.length);
                return transcriptText || null;
            }
            // JSON format
            else if (responseText.trim().startsWith('{')) {
                console.log('[BringYourSub] Parsing JSON transcript...');
                const data = JSON.parse(responseText);
                const transcriptText = data.events
                    ?.filter((e: any) => e.segs)
                    .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                console.log('[BringYourSub] JSON transcript parsed successfully, length:', transcriptText?.length);
                return transcriptText || null;
            } else {
                console.error('[BringYourSub] Unknown transcript format, starts with:', responseText.substring(0, 50));
                return null;
            }
        } catch (e) {
            console.error('[BringYourSub] Failed to parse transcript:', e);
            return null;
        }

    } catch (error) {
        console.error('[BringYourSub] Transcript extraction error:', error);
        return null;
    }
}

// Inject Main World Script at start (only if not already injected)
function injectMainWorldScript() {
    // Check if already injected
    if ((window as any).__bysInjected) {
        console.log('[BringYourSub] Injected script already present');
        return;
    }

    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('extension/content/injected.js');
        script.onload = () => {
            script.remove();
            (window as any).__bysInjected = true;
            console.log('[BringYourSub] Injected script loaded successfully');
        };
        script.onerror = (e) => {
            console.error('[BringYourSub] Failed to load injected script:', e);
        };
        (document.head || document.documentElement).appendChild(script);
        console.log('[BringYourSub] Injected script element added');
    } catch (e) {
        console.error('[BringYourSub] Failed to inject main world script:', e);
    }
}

// Run injection
injectMainWorldScript();


// Re-initialize on YouTube SPA navigation
let lastUrl = location.href;
// Safe MutationObserver
try {
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (location.href.includes('youtube.com/watch')) {
                setTimeout(safeInit, 1000);
            }
        }
    });

    if (document.body) {
        observer.observe(document.body, { subtree: true, childList: true });
    } else {
        // Fallback if body not ready
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { subtree: true, childList: true });
        });
    }
} catch (e) {
    console.error('[BringYourSub] MutationObserver failed:', e);
}

// Wrapper for safe initialization
function safeInit() {
    try {
        initOverlay();
    } catch (e) {
        console.error('[BringYourSub] Init overlay failed:', e);
    }
}

// Initial call
safeInit();
