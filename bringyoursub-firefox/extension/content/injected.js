(function () {
    console.log('[BringYourSub Injected] Script loaded in main world');

    // ===== CAPTION INTERCEPTOR =====
    // Intercept XHR and fetch requests to capture timedtext data
    const capturedCaptions = new Map();

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        this._bysUrl = url;
        return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const url = this._bysUrl;
        if (url && typeof url === 'string' && url.includes('timedtext')) {
            console.log('[BringYourSub Interceptor] Detected timedtext XHR');

            this.addEventListener('load', function () {
                if (this.status === 200 && this.responseText && this.responseText.length > 0) {
                    console.log('[BringYourSub Interceptor] Captured timedtext, length:', this.responseText.length);
                    capturedCaptions.set('timedtext', {
                        text: this.responseText,
                        timestamp: Date.now()
                    });
                    window.postMessage({ type: 'BYS_CAPTIONS_CAPTURED', length: this.responseText.length }, '*');
                }
            });
        }
        return originalXHRSend.apply(this, args);
    };

    // Intercept fetch (wrapped in try-catch since window.fetch may be read-only)
    try {
        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            const url = typeof input === 'string' ? input : input?.url;

            if (url && url.includes('timedtext')) {
                console.log('[BringYourSub Interceptor] Detected timedtext fetch');

                const response = await originalFetch.call(this, input, init);
                const clonedResponse = response.clone();

                try {
                    const text = await clonedResponse.text();
                    if (text && text.length > 0) {
                        console.log('[BringYourSub Interceptor] Captured timedtext fetch, length:', text.length);
                        capturedCaptions.set('timedtext', {
                            text: text,
                            timestamp: Date.now()
                        });
                        window.postMessage({ type: 'BYS_CAPTIONS_CAPTURED', length: text.length }, '*');
                    }
                } catch (e) {
                    console.log('[BringYourSub Interceptor] Failed to read fetch response');
                }

                return response;
            }

            return originalFetch.call(this, input, init);
        };
        console.log('[BringYourSub Injected] Fetch interceptor installed');
    } catch (e) {
        console.log('[BringYourSub Injected] Could not intercept fetch (read-only), XHR interceptor will be used');
    }

    // ===== MESSAGE HANDLERS =====
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        // Handle request for ytInitialPlayerResponse
        if (event.data.type === 'BYS_GET_PLAYER_RESPONSE') {
            try {
                const playerResponse = window.ytInitialPlayerResponse;
                if (playerResponse) {
                    window.postMessage({
                        type: 'BYS_PLAYER_RESPONSE',
                        playerResponse: playerResponse,
                        requestId: event.data.requestId
                    }, '*');
                } else {
                    window.postMessage({
                        type: 'BYS_PLAYER_RESPONSE',
                        playerResponse: null,
                        requestId: event.data.requestId
                    }, '*');
                }
            } catch (error) {
                window.postMessage({
                    type: 'BYS_PLAYER_RESPONSE',
                    playerResponse: null,
                    requestId: event.data.requestId
                }, '*');
            }
        }

        // Main caption extraction handler
        if (event.data.type === 'BYS_GET_CAPTIONS_FROM_PLAYER') {
            console.log('[BringYourSub Injected] Attempting to extract captions...');

            try {
                let captionText = null;
                const videoId = new URLSearchParams(window.location.search).get('v');

                // Step 1: Check if we already captured captions via interceptor
                const captured = capturedCaptions.get('timedtext');
                if (captured && captured.text && captured.text.length > 100) {
                    console.log('[BringYourSub Injected] Using intercepted captions, length:', captured.text.length);
                    captionText = parseTimedText(captured.text);
                    if (captionText && captionText.length > 100) {
                        console.log('[BringYourSub Injected] Parsed intercepted captions successfully');
                        window.postMessage({
                            type: 'BYS_CAPTIONS_RESULT',
                            captionText: captionText,
                            requestId: event.data.requestId
                        }, '*');
                        return;
                    }
                }

                // Step 2: Use ANDROID client Innertube API (most reliable method)
                if (!captionText && videoId) {
                    console.log('[BringYourSub Injected] Trying ANDROID client Innertube API...');

                    // Extract API key from page, or use public fallback
                    // NOTE: The fallback key below is a PUBLIC YouTube Innertube API key
                    // It is NOT a secret - it's exposed in YouTube's page source and used by
                    // many open-source tools (yt-dlp, youtube-dl, etc.)
                    // See: https://github.com/yt-dlp/yt-dlp
                    const html = document.documentElement.innerHTML;
                    const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
                    const apiKey = keyMatch ? keyMatch[1] : 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
                    console.log('[BringYourSub Injected] Using API key:', apiKey.substring(0, 15) + '...');

                    try {
                        // Use ANDROID client for better success rate
                        const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                context: {
                                    client: {
                                        clientName: 'ANDROID',
                                        clientVersion: '19.09.37',
                                        androidSdkVersion: 30,
                                        hl: 'en',
                                        gl: 'US'
                                    }
                                },
                                videoId: videoId
                            })
                        });

                        if (playerRes.ok) {
                            const data = await playerRes.json();
                            console.log('[BringYourSub Injected] ANDROID player response received');

                            const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                            if (tracks && tracks.length > 0) {
                                console.log('[BringYourSub Injected] Found', tracks.length, 'caption tracks from ANDROID API');

                                // Find preferred track (English or first available)
                                const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                                if (track?.baseUrl) {
                                    console.log('[BringYourSub Injected] Fetching captions from:', track.languageCode);

                                    // Fetch the caption XML
                                    const captionRes = await fetch(track.baseUrl);
                                    const xml = await captionRes.text();

                                    if (xml && xml.length > 0) {
                                        console.log('[BringYourSub Injected] Got caption XML, length:', xml.length);
                                        captionText = parseTimedText(xml);

                                        if (captionText && captionText.length > 100) {
                                            console.log('[BringYourSub Injected] ANDROID method SUCCESS! Length:', captionText.length);
                                        }
                                    } else {
                                        console.log('[BringYourSub Injected] Empty caption response');
                                    }
                                }
                            } else {
                                console.log('[BringYourSub Injected] No caption tracks in ANDROID response');
                            }
                        } else {
                            console.log('[BringYourSub Injected] ANDROID API failed:', playerRes.status);
                        }
                    } catch (err) {
                        console.log('[BringYourSub Injected] ANDROID API error:', err.message);
                    }
                }

                // Step 3: Try WEB client as fallback
                if (!captionText && videoId) {
                    console.log('[BringYourSub Injected] Trying WEB client fallback...');

                    const player = document.querySelector('#movie_player');
                    if (player && typeof player.getPlayerResponse === 'function') {
                        const response = player.getPlayerResponse();

                        if (response?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                            const tracks = response.captions.playerCaptionsTracklistRenderer.captionTracks;
                            console.log('[BringYourSub Injected] Found', tracks.length, 'tracks from WEB player');

                            const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                            if (track?.baseUrl) {
                                // Enable captions to trigger fetch (may help with POT)
                                if (typeof player.setOption === 'function') {
                                    player.setOption('captions', 'track', { languageCode: track.languageCode });
                                }

                                // Wait for interceptor
                                await new Promise(resolve => setTimeout(resolve, 2000));

                                const newCaptured = capturedCaptions.get('timedtext');
                                if (newCaptured && newCaptured.text && newCaptured.text.length > 100) {
                                    captionText = parseTimedText(newCaptured.text);
                                }
                            }
                        }
                    }
                }

                // Step 4: Try DOM extraction from transcript panel
                if (!captionText) {
                    console.log('[BringYourSub Injected] Trying DOM extraction...');

                    const transcriptToggle = document.querySelector('[target-id="engagement-panel-searchable-transcript"]');
                    if (transcriptToggle) {
                        transcriptToggle.click();

                        for (let i = 0; i < 15; i++) {
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Check interceptor
                            const captured = capturedCaptions.get('timedtext');
                            if (captured && captured.text && Date.now() - captured.timestamp < 10000) {
                                captionText = parseTimedText(captured.text);
                                if (captionText && captionText.length > 100) break;
                            }

                            // Check DOM segments
                            const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
                            if (segments.length > 0) {
                                const texts = [];
                                for (const seg of segments) {
                                    const textEl = seg.querySelector('.segment-text, yt-formatted-string');
                                    if (textEl?.textContent) {
                                        texts.push(textEl.textContent.trim());
                                    }
                                }
                                if (texts.length > 0) {
                                    captionText = texts.join(' ');
                                    console.log('[BringYourSub Injected] DOM extraction success, length:', captionText.length);
                                    break;
                                }
                            }
                        }
                    }
                }

                // Step 5: Fallback to visible captions
                if (!captionText || captionText.length < 100) {
                    const captionElements = document.querySelectorAll('.ytp-caption-segment');
                    if (captionElements.length > 0) {
                        console.log('[BringYourSub Injected] Fallback: visible captions');
                        const visibleText = Array.from(captionElements)
                            .map(el => el.textContent?.trim())
                            .filter(t => t && t.length > 0)
                            .join(' ');
                        if (visibleText.length > (captionText?.length || 0)) {
                            captionText = visibleText;
                        }
                    }
                }

                window.postMessage({
                    type: 'BYS_CAPTIONS_RESULT',
                    captionText: captionText,
                    requestId: event.data.requestId
                }, '*');

            } catch (error) {
                console.error('[BringYourSub Injected] Error:', error);
                window.postMessage({
                    type: 'BYS_CAPTIONS_RESULT',
                    captionText: null,
                    error: error.message,
                    requestId: event.data.requestId
                }, '*');
            }
        }

        // Handle direct fetch requests
        if (event.data.type === 'BYS_FETCH_REQUEST') {
            const url = event.data.url;
            console.log('[BringYourSub Injected] Direct fetch request');

            try {
                const response = await fetch(url, { credentials: 'include' });
                const text = await response.text();

                if (text && text.length > 0) {
                    window.postMessage({
                        type: 'BYS_FETCH_SUCCESS',
                        text: text,
                        requestId: event.data.requestId
                    }, '*');
                } else {
                    window.postMessage({
                        type: 'BYS_FETCH_ERROR',
                        error: 'Empty response',
                        requestId: event.data.requestId
                    }, '*');
                }
            } catch (error) {
                window.postMessage({
                    type: 'BYS_FETCH_ERROR',
                    error: error.message,
                    requestId: event.data.requestId
                }, '*');
            }
        }
    });

    // ===== HELPER FUNCTIONS =====

    function parseTimedText(text) {
        if (!text || text.length === 0) return null;

        const trimmed = text.trim();

        // Try JSON format (json3)
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const data = JSON.parse(text);

                // YouTube json3 format: { events: [{ segs: [{ utf8: "text" }] }] }
                if (data.events) {
                    const result = data.events
                        .filter(e => e.segs)
                        .map(e => e.segs.map(s => s.utf8 || '').join(''))
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (result.length > 0) {
                        console.log('[BringYourSub] Parsed json3 format');
                        return result;
                    }
                }
            } catch (e) {
                // Not JSON, try XML
            }
        }

        // Try XML format using regex (DOMParser is blocked by Trusted Types on YouTube)
        if (trimmed.startsWith('<')) {
            try {
                // Use regex to extract text content from <text> elements
                const textMatches = text.match(/<text[^>]*>([^<]*)<\/text>/g);

                if (textMatches && textMatches.length > 0) {
                    const result = textMatches
                        .map(match => {
                            // Extract content between tags
                            const content = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
                            return decodeHtmlEntities(content);
                        })
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    console.log('[BringYourSub] Parsed XML format (regex), segments:', textMatches.length);
                    return result;
                }

                // Try alternate XML structure (nested tags with text content)
                const altMatches = text.match(/<[^>]+>([^<]+)<\/[^>]+>/g);
                if (altMatches && altMatches.length > 0) {
                    const result = altMatches
                        .map(match => {
                            const content = match.replace(/<[^>]+>/g, '');
                            return decodeHtmlEntities(content);
                        })
                        .filter(t => t.trim().length > 0)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (result.length > 0) {
                        console.log('[BringYourSub] Parsed XML (alt regex), text length:', result.length);
                        return result;
                    }
                }
            } catch (e) {
                console.log('[BringYourSub] XML regex parse failed:', e.message);
            }
        }

        return null;
    }

    function decodeHtmlEntities(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/\n/g, ' ');
    }
})();
