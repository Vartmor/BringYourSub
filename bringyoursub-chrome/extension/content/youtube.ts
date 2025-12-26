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
     * Check if subtitles have been loaded
     */
    hasCues(): boolean {
        return this.cues.length > 0;
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

// =====================
// YouTube Player Button
// =====================
function injectPlayerButton(): void {
    // Check if button already exists
    if (document.getElementById('bys-player-btn')) return;

    // Find the right controls container
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) {
        setTimeout(injectPlayerButton, 1000);
        return;
    }

    // Create the button
    const button = document.createElement('button');
    button.id = 'bys-player-btn';
    button.className = 'ytp-button';
    button.title = 'BringYourSub - Generate Subtitles';
    button.innerHTML = `
        <svg height="100%" viewBox="0 0 36 36" width="100%">
            <path d="M11 11v14h14V11H11zm12 12H13v-2h10v2zm0-4H13v-2h10v2zm0-4H13v-2h10v2z" 
                  fill="#fff" fill-opacity="0.85"/>
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
    if (settingsBtn) {
        rightControls.insertBefore(button, settingsBtn);
    } else {
        rightControls.appendChild(button);
    }

    console.log('[BringYourSub] Player button injected');
}

// Show a toast message on the video player
function showPlayerToast(message: string): void {
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
}

// Initialize when video container is available
function initOverlay(): void {
    const videoContainer = document.querySelector('.html5-video-container');
    if (videoContainer) {
        subtitleOverlay.init();
        injectPlayerButton();
    } else {
        // Retry after a short delay (YouTube loads dynamically)
        setTimeout(initOverlay, 1000);
    }
}

// Start initialization
initOverlay();

// =====================
// Transcript Extraction (runs on YouTube page)
// =====================
async function extractTranscript(): Promise<string | null> {
    try {
        // Try to get ytInitialPlayerResponse from page
        const scripts = document.querySelectorAll('script');
        let playerResponse: any = null;

        for (const script of scripts) {
            const content = script.textContent || '';
            const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (match) {
                try {
                    playerResponse = JSON.parse(match[1]);
                    break;
                } catch { continue; }
            }
        }

        if (!playerResponse) {
            // Try window object (may work in some cases)
            playerResponse = (window as any).ytInitialPlayerResponse;
        }

        if (!playerResponse) {
            console.log('[BringYourSub] No player response found');
            return null;
        }

        const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captions || captions.length === 0) {
            console.log('[BringYourSub] No captions available');
            return null;
        }

        // Prefer English or first track
        const track = captions.find((t: any) => t.languageCode === 'en') || captions[0];
        const transcriptResponse = await fetch(track.baseUrl + '&fmt=json3');
        const transcriptData = await transcriptResponse.json();

        // Extract text
        const text = transcriptData.events
            ?.filter((e: any) => e.segs)
            .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log('[BringYourSub] Transcript extracted, length:', text?.length || 0);
        return text || null;
    } catch (error) {
        console.error('[BringYourSub] Transcript extraction error:', error);
        return null;
    }
}

// =====================
// Message Handling
// =====================
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
