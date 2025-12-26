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
    private isActive = false;
    private fontSize = 'medium';
    private position = 'bottom';

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
    }

    /**
     * Create the subtitle overlay container
     */
    private createOverlay(): void {
        // Remove existing overlay if any
        this.destroy();

        const videoContainer = document.querySelector('.html5-video-container');
        if (!videoContainer) return;

        this.container = document.createElement('div');
        this.container.id = 'bys-subtitle-overlay';
        this.container.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            z-index: 60;
            display: flex;
            justify-content: center;
            pointer-events: none;
            transition: opacity 0.2s ease;
        `;
        this.updatePosition();

        this.textElement = document.createElement('div');
        this.textElement.id = 'bys-subtitle-text';
        this.textElement.style.cssText = `
            background: rgba(0, 0, 0, 0.75);
            color: #ffffff;
            padding: 8px 16px;
            border-radius: 6px;
            font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
            text-align: center;
            max-width: 80%;
            line-height: 1.4;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.2s ease;
        `;
        this.updateFontSize();

        this.container.appendChild(this.textElement);
        videoContainer.appendChild(this.container);
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
     */
    apply(subtitles: string, fontSize?: string, position?: string): void {
        if (fontSize) {
            this.fontSize = fontSize;
            this.updateFontSize();
        }
        if (position) {
            this.position = position;
            this.updatePosition();
        }

        this.cues = this.parseSRT(subtitles);
        this.isActive = true;

        // Hide YouTube's native captions
        this.hideNativeCaptions();

        // Start syncing
        this.startSync();

        console.log(`[BringYourSub] Applied ${this.cues.length} subtitle cues`);
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

        const sync = (): void => {
            this.updateSubtitle();
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
    private updateSubtitle(): void {
        if (!this.video || !this.textElement || !this.isActive) return;

        const currentTime = this.video.currentTime;
        const currentCue = this.cues.find(
            cue => currentTime >= cue.start && currentTime <= cue.end
        );

        if (currentCue) {
            this.textElement.textContent = currentCue.text;
            this.textElement.style.opacity = '1';
            this.textElement.style.transform = 'translateY(0)';
        } else {
            this.textElement.style.opacity = '0';
            this.textElement.style.transform = 'translateY(10px)';
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
     * Remove the overlay
     */
    destroy(): void {
        this.stopSync();
        this.isActive = false;

        const existing = document.getElementById('bys-subtitle-overlay');
        if (existing) existing.remove();

        this.showNativeCaptions();
        this.cues = [];
    }
}

// =====================
// Singleton Instance
// =====================
const subtitleOverlay = new SubtitleOverlay();

// Initialize when video container is available
function initOverlay(): void {
    const videoContainer = document.querySelector('.html5-video-container');
    if (videoContainer) {
        subtitleOverlay.init();
    } else {
        // Retry after a short delay (YouTube loads dynamically)
        setTimeout(initOverlay, 1000);
    }
}

// Start initialization
initOverlay();

// =====================
// Message Handling
// =====================
chrome.runtime.onMessage.addListener((
    message: SubtitleMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success?: boolean; title?: string; channel?: string }) => void
): boolean | void => {

    if (message.action === 'GET_METADATA') {
        const title = document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() || 'Unknown';
        const channel = document.querySelector('ytd-channel-name #text')?.textContent?.trim() || 'Unknown';
        sendResponse({ title, channel });
        return true;
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

// Re-initialize on YouTube SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('youtube.com/watch')) {
            setTimeout(initOverlay, 1000);
        }
    }
}).observe(document.body, { subtree: true, childList: true });
