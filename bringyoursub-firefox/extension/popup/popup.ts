/**
 * BringYourSub - Popup UI Controller
 * 
 * Handles all popup interactions including:
 * - Tab navigation with smooth animations
 * - Theme switching (dark/light)
 * - Toast notifications
 * - API key validation
 * - Settings management
 * - Subtitle generation
 * 
 * @module popup/popup
 */

// =====================
// Imports
// =====================
import { Icons, setIcon } from './icons';
import { initTheme, toggleTheme, getCurrentTheme, watchSystemTheme } from './theme';
import { LANGUAGES, DEFAULT_LANGUAGE } from './languages';

// =====================
// Firefox Polyfill (MUST BE FIRST)
// =====================
declare const browser: typeof chrome | undefined;
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
    (globalThis as any).chrome = browser;
} else if (typeof browser !== 'undefined') {
    // Firefox with chrome defined but browser is the real API
    (globalThis as any).chrome = browser;
}
console.log('[BringYourSub] Popup loaded, chrome API:', typeof chrome !== 'undefined' ? 'available' : 'missing');

// =====================
// DOM Elements
// =====================
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');
const tabsContainer = document.querySelector<HTMLElement>('.tabs');

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const toggleKeyBtn = document.getElementById('toggleKey') as HTMLButtonElement;
const testKeyBtn = document.getElementById('testKey') as HTMLButtonElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const themeToggleBtn = document.getElementById('themeToggle') as HTMLButtonElement;
const dualSubtitlesToggle = document.getElementById('dualSubtitles') as HTMLInputElement;

const progressContainer = document.getElementById('progressContainer') as HTMLDivElement;
const progressFill = document.getElementById('progressFill') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLParagraphElement;
const steps = document.querySelectorAll<HTMLElement>('.step');

const resultContainer = document.getElementById('resultContainer') as HTMLDivElement;
const outputPreview = document.getElementById('outputPreview') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
const applyBtn = document.getElementById('applyBtn') as HTMLButtonElement;

const toastContainer = document.getElementById('toastContainer') as HTMLDivElement;

// Settings elements
const fontSizeSelect = document.getElementById('fontSize') as HTMLSelectElement;
const positionSelect = document.getElementById('position') as HTMLSelectElement;
const autoApplyCheckbox = document.getElementById('autoApply') as HTMLInputElement;
const hideOnPauseCheckbox = document.getElementById('hideOnPause') as HTMLInputElement;
const enableDragCheckbox = document.getElementById('enableDrag') as HTMLInputElement;
const bgOpacitySlider = document.getElementById('bgOpacity') as HTMLInputElement;
const bgOpacityValue = document.getElementById('bgOpacityValue') as HTMLSpanElement;
const syncOffsetInput = document.getElementById('syncOffset') as HTMLInputElement;
const saveSettingsBtn = document.getElementById('saveSettings') as HTMLButtonElement;
const refreshModelsBtn = document.getElementById('refreshModels') as HTMLButtonElement;

// =====================
// Settings Interface
// =====================
interface Settings {
    openaiApiKey: string;
    targetLanguage: string;
    fontSize: string;
    position: string;
    autoApply: boolean;
    hideOnPause: boolean;
    enableDrag: boolean;
    bgOpacity: number;
    syncOffset: number;
    model: string;
    dualSubtitles: boolean;
}

// =====================
// Initialize Icons
// =====================
function initIcons(): void {
    // Header
    setIcon(document.getElementById('logo')!, 'film');
    setIcon(document.getElementById('iconSun')!, 'sun');
    setIcon(document.getElementById('iconMoon')!, 'moon');

    // Tab icons
    setIcon(document.getElementById('tabIconGenerate')!, 'sparkles');
    setIcon(document.getElementById('tabIconSettings')!, 'settings');
    setIcon(document.getElementById('tabIconAbout')!, 'info');

    // Generate tab
    setIcon(document.getElementById('labelIconKey')!, 'key');
    setIcon(document.getElementById('labelIconModel')!, 'cpu');
    setIcon(document.getElementById('labelIconLanguage')!, 'globe');
    setIcon(document.getElementById('labelIconDual')!, 'languages');
    setIcon(document.getElementById('toggleKeyIcon')!, 'eye');
    setIcon(document.getElementById('refreshModelsIcon')!, 'refresh');
    setIcon(document.getElementById('generateBtnIcon')!, 'sparkles');

    // Result section
    setIcon(document.getElementById('resultBadgeIcon')!, 'check');
    setIcon(document.getElementById('copyBtnIcon')!, 'copy');
    setIcon(document.getElementById('downloadBtnIcon')!, 'download');
    setIcon(document.getElementById('applyBtnIcon')!, 'play');

    // Settings tab
    setIcon(document.getElementById('settingsIconDisplay')!, 'subtitles');
    setIcon(document.getElementById('settingsIconBehavior')!, 'sliders');
    setIcon(document.getElementById('saveSettingsIcon')!, 'save');

    // About tab
    setIcon(document.getElementById('aboutLogoIcon')!, 'film');
    setIcon(document.getElementById('featureIconKey')!, 'key');
    setIcon(document.getElementById('featureIconCloud')!, 'cloud');
    setIcon(document.getElementById('featureIconShield')!, 'shield');
    setIcon(document.getElementById('featureIconBrain')!, 'brain');
    setIcon(document.getElementById('featureIconMic')!, 'mic');
    setIcon(document.getElementById('linkIconGithub')!, 'github');
    setIcon(document.getElementById('linkIconPrivacy')!, 'shield');
    setIcon(document.getElementById('linkIconApi')!, 'key');
    setIcon(document.getElementById('creditHeart')!, 'heart');
}

// =====================
// Populate Languages
// =====================
function populateLanguages(): void {
    languageSelect.innerHTML = '';
    LANGUAGES.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.name;
        option.textContent = `${lang.flag} ${lang.name}`;
        languageSelect.appendChild(option);
    });
}

// =====================
// Toast Notifications
// =====================
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// =====================
// Tab Navigation
// =====================
function switchTab(tabName: string): void {
    // Update tab buttons
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tabs container data attribute for indicator animation
    if (tabsContainer) {
        tabsContainer.dataset.active = tabName;
    }

    // Show corresponding content with animation
    tabContents.forEach(content => {
        const isActive = content.id === `tab-${tabName}`;
        content.classList.toggle('active', isActive);
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        if (tabName) switchTab(tabName);
    });
});

// =====================
// Theme Management
// =====================
async function setupTheme(): Promise<void> {
    await initTheme();

    themeToggleBtn?.addEventListener('click', async () => {
        await toggleTheme();
    });

    watchSystemTheme(() => {
        // Theme changed via system preference
    });
}

// =====================
// API Key Management
// =====================
let keyVisible = false;

toggleKeyBtn?.addEventListener('click', () => {
    keyVisible = !keyVisible;
    apiKeyInput.type = keyVisible ? 'text' : 'password';
    const icon = document.getElementById('toggleKeyIcon');
    if (icon) {
        setIcon(icon, keyVisible ? 'eyeOff' : 'eye');
    }
});

testKeyBtn?.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showToast('Please enter an API key', 'error');
        return;
    }

    testKeyBtn.classList.add('loading');
    testKeyBtn.classList.remove('success', 'error');

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (response.ok) {
            testKeyBtn.classList.remove('loading');
            testKeyBtn.classList.add('success');
            testKeyBtn.querySelector('.test-text')!.textContent = 'Valid';
            showToast('API Key is valid!', 'success');

            // Save the valid key
            chrome.storage.local.set({ openaiApiKey: key });
        } else {
            throw new Error('Invalid key');
        }
    } catch {
        testKeyBtn.classList.remove('loading');
        testKeyBtn.classList.add('error');
        testKeyBtn.querySelector('.test-text')!.textContent = 'Invalid';
        showToast('Invalid API Key', 'error');
    }

    // Reset button after 3 seconds
    setTimeout(() => {
        testKeyBtn.classList.remove('success', 'error');
        testKeyBtn.querySelector('.test-text')!.textContent = 'Test';
    }, 3000);
});

// =====================
// Model Refresh
// =====================
refreshModelsBtn?.addEventListener('click', async () => {
    const icon = document.getElementById('refreshModelsIcon');
    if (icon) {
        icon.classList.add('animate-spin');
    }

    // Simulate model fetch (will be replaced with actual API call in Phase 2)
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (icon) {
        icon.classList.remove('animate-spin');
    }
    showToast('Models refreshed', 'info');
});

// =====================
// Range Slider
// =====================
bgOpacitySlider?.addEventListener('input', () => {
    if (bgOpacityValue) {
        bgOpacityValue.textContent = `${bgOpacitySlider.value}%`;
    }
});

// =====================
// Number Input Controls
// =====================
document.querySelectorAll('.number-input button').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const input = document.getElementById(target!) as HTMLInputElement;
        if (!input) return;

        const step = parseInt(input.step) || 100;
        const min = parseInt(input.min);
        const max = parseInt(input.max);
        let value = parseInt(input.value) || 0;

        if (btn.classList.contains('increment')) {
            value = Math.min(max, value + step);
        } else {
            value = Math.max(min, value - step);
        }

        input.value = value.toString();
    });
});

// =====================
// Progress Management
// =====================
function updateProgress(stepNumber: number, status: string): void {
    // Update progress bar
    const percentage = (stepNumber / 4) * 100;
    progressFill.style.width = `${percentage}%`;

    // Update steps
    steps.forEach((step, index) => {
        step.classList.remove('active', 'complete');
        if (index + 1 < stepNumber) {
            step.classList.add('complete');
        } else if (index + 1 === stepNumber) {
            step.classList.add('active');
        }
    });

    // Update status text
    statusText.textContent = status;
}

function resetProgress(): void {
    progressFill.style.width = '0%';
    steps.forEach(step => step.classList.remove('active', 'complete'));
    statusText.textContent = 'Initializing...';
}

// =====================
// Subtitle Generation
// =====================
generateBtn?.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const language = languageSelect.value;

    if (!apiKey) {
        showToast('API Key required', 'error');
        return;
    }

    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('youtube.com/watch')) {
        showToast('Please open a YouTube video first', 'error');
        return;
    }

    const videoId = new URL(tab.url).searchParams.get('v');
    if (!videoId) {
        showToast('Could not find Video ID', 'error');
        return;
    }

    // Show progress
    progressContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    generateBtn.disabled = true;
    resetProgress();
    updateProgress(1, 'Extracting transcript...');

    try {
        // Get model from settings
        const settings = await chrome.storage.local.get(['model']);
        const model = settings.model || 'gpt-4o-mini';

        // Set timeout for no response
        let responseReceived = false;
        const timeoutId = setTimeout(() => {
            if (!responseReceived) {
                showToast('Generation timed out. Check console for errors.', 'error');
                resetUI();
            }
        }, 120000); // 2 minute timeout

        chrome.runtime.sendMessage({
            action: 'GENERATE_SUBTITLES',
            videoId,
            apiKey,
            language,
            model,
            videoTitle: tab.title || 'Unknown Video'
        }, async (response) => {
            responseReceived = true;
            clearTimeout(timeoutId);

            // Check for Chrome runtime errors
            if (chrome.runtime.lastError) {
                console.error('[BringYourSub] Runtime error:', chrome.runtime.lastError);
                showToast('Error: ' + chrome.runtime.lastError.message, 'error');
                resetUI();
                return;
            }

            if (!response) {
                showToast('No response from background. Try reloading extension.', 'error');
                resetUI();
                return;
            }

            if (response.error) {
                showToast('Error: ' + response.error, 'error');
                resetUI();
            } else if (response.subtitles) {
                updateProgress(4, 'Complete!');
                showResult(response.subtitles);
                showToast('Subtitles generated successfully!', 'success');

                // Auto-apply if enabled
                const autoSettings = await chrome.storage.local.get(['autoApply']);
                if (autoSettings.autoApply) {
                    applySubtitlesToVideo(response.subtitles);
                }
            } else {
                showToast('Unexpected response format', 'error');
                resetUI();
            }
        });
    } catch (err) {
        console.error('[BringYourSub] Generate error:', err);
        showToast('Unexpected error occurred', 'error');
        resetUI();
    }
});

function showResult(subtitles: string): void {
    progressContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    outputPreview.value = subtitles;
    generateBtn.disabled = false;

    // Save generated subtitles for this video
    saveGeneratedSubtitles(subtitles);
}

async function saveGeneratedSubtitles(subtitles: string): Promise<void> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('youtube.com/watch')) return;

        const videoId = new URL(tab.url).searchParams.get('v');
        if (!videoId) return;

        await chrome.storage.local.set({
            [`generated_${videoId}`]: {
                subtitles,
                timestamp: Date.now()
            }
        });
        console.log('[BringYourSub] Saved generated subtitles for video:', videoId);
    } catch (e) {
        console.error('[BringYourSub] Failed to save generated subtitles:', e);
    }
}

async function restoreGeneratedSubtitles(): Promise<void> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('youtube.com/watch')) return;

        const videoId = new URL(tab.url).searchParams.get('v');
        if (!videoId) return;

        const result = await chrome.storage.local.get(`generated_${videoId}`);
        const saved = result[`generated_${videoId}`];

        if (saved && saved.subtitles) {
            console.log('[BringYourSub] Restoring generated subtitles for video:', videoId);
            outputPreview.value = saved.subtitles;
            resultContainer.classList.remove('hidden');
        }
    } catch (e) {
        console.error('[BringYourSub] Failed to restore generated subtitles:', e);
    }
}

function resetUI(): void {
    progressContainer.classList.add('hidden');
    generateBtn.disabled = false;
    resetProgress();
}

// =====================
// Result Actions
// =====================
copyBtn?.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(outputPreview.value);
        const icon = document.getElementById('copyBtnIcon');
        if (icon) setIcon(icon, 'check');
        copyBtn.querySelector('span:last-child')!.textContent = 'Copied!';
        showToast('Copied to clipboard', 'success');
        setTimeout(() => {
            if (icon) setIcon(icon, 'copy');
            copyBtn.querySelector('span:last-child')!.textContent = 'Copy';
        }, 2000);
    } catch {
        showToast('Failed to copy', 'error');
    }
});

downloadBtn?.addEventListener('click', () => {
    const text = outputPreview.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download started', 'info');
});

applyBtn?.addEventListener('click', () => {
    applySubtitlesToVideo(outputPreview.value);
});

async function applySubtitlesToVideo(subtitles: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Get settings
    const settings = await chrome.storage.local.get(['fontSize', 'position', 'bgOpacity', 'enableDrag']);

    chrome.tabs.sendMessage(tab.id, {
        action: 'APPLY_SUBTITLES',
        subtitles,
        fontSize: settings.fontSize || 'medium',
        position: settings.position || 'bottom',
        bgOpacity: settings.bgOpacity || 75,
        enableDrag: settings.enableDrag || false
    }, (response) => {
        if (response?.success) {
            showToast('Subtitles applied to video!', 'success');
        } else {
            showToast('Failed to apply subtitles', 'error');
        }
    });
}

// =====================
// Settings Management
// =====================
saveSettingsBtn?.addEventListener('click', async () => {
    const settings: Partial<Settings> = {
        fontSize: fontSizeSelect?.value,
        position: positionSelect?.value,
        autoApply: autoApplyCheckbox?.checked,
        hideOnPause: hideOnPauseCheckbox?.checked,
        enableDrag: enableDragCheckbox?.checked,
        bgOpacity: parseInt(bgOpacitySlider?.value || '75'),
        syncOffset: parseInt(syncOffsetInput?.value || '0'),
        model: modelSelect?.value,
        dualSubtitles: dualSubtitlesToggle?.checked
    };

    await chrome.storage.local.set(settings);
    showToast('Settings saved!', 'success');
});

// =====================
// Load Saved Data
// =====================
async function loadSavedData(): Promise<void> {
    const data = await chrome.storage.local.get([
        'openaiApiKey',
        'targetLanguage',
        'fontSize',
        'position',
        'autoApply',
        'hideOnPause',
        'enableDrag',
        'bgOpacity',
        'syncOffset',
        'model',
        'dualSubtitles'
    ]);

    if (data.openaiApiKey) apiKeyInput.value = data.openaiApiKey;
    if (data.targetLanguage) languageSelect.value = data.targetLanguage;
    if (data.fontSize && fontSizeSelect) fontSizeSelect.value = data.fontSize;
    if (data.position && positionSelect) positionSelect.value = data.position;
    if (data.autoApply !== undefined && autoApplyCheckbox) autoApplyCheckbox.checked = data.autoApply;
    if (data.hideOnPause !== undefined && hideOnPauseCheckbox) hideOnPauseCheckbox.checked = data.hideOnPause;
    if (data.enableDrag !== undefined && enableDragCheckbox) enableDragCheckbox.checked = data.enableDrag;
    if (data.bgOpacity !== undefined && bgOpacitySlider) {
        bgOpacitySlider.value = data.bgOpacity.toString();
        if (bgOpacityValue) bgOpacityValue.textContent = `${data.bgOpacity}%`;
    }
    if (data.syncOffset !== undefined && syncOffsetInput) syncOffsetInput.value = data.syncOffset.toString();
    if (data.model && modelSelect) modelSelect.value = data.model;
    if (data.dualSubtitles !== undefined && dualSubtitlesToggle) dualSubtitlesToggle.checked = data.dualSubtitles;

    // Restore any previously generated subtitles for current video
    restoreGeneratedSubtitles();
}

// Save language when changed
languageSelect?.addEventListener('change', () => {
    chrome.storage.local.set({ targetLanguage: languageSelect.value }, () => {
        console.log('[BringYourSub] Language saved:', languageSelect.value);
    });
});

// Save API key on every input
apiKeyInput?.addEventListener('input', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        chrome.storage.local.set({ openaiApiKey: key });
    }
});

// =====================
// Progress Updates from Background
// =====================
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'UPDATE_PROGRESS') {
        const stepMap: { [key: string]: number } = {
            'Checking for native transcript...': 1,
            'No native transcript found': 1,
            'Processing context and chunking...': 2,
            'Translating': 3
        };

        for (const [prefix, step] of Object.entries(stepMap)) {
            if (message.text.includes(prefix)) {
                updateProgress(step, message.text);
                break;
            }
        }
    }
});

// =====================
// YouTube Detection
// =====================
async function checkYouTubeVideo(): Promise<void> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isYouTube = tab?.url?.includes('youtube.com/watch');

        const generateBtnIcon = document.getElementById('generateBtnIcon');
        const generateBtnText = generateBtn?.querySelector('.btn-text');

        if (isYouTube) {
            if (generateBtn) generateBtn.disabled = false;
            if (generateBtnIcon) setIcon(generateBtnIcon, 'sparkles');
            if (generateBtnText) generateBtnText.textContent = 'Generate Subtitles';
        } else {
            if (generateBtn) generateBtn.disabled = true;
            if (generateBtnIcon) setIcon(generateBtnIcon, 'film');
            if (generateBtnText) generateBtnText.textContent = 'Open a YouTube Video';
        }
    } catch (err) {
        console.error('[BringYourSub] Tab query error:', err);
    }
}

// =====================
// Initialize
// =====================
async function init(): Promise<void> {
    initIcons();
    populateLanguages();
    await setupTheme();
    await loadSavedData();
    await checkYouTubeVideo();

    console.log('[BringYourSub] Popup initialized');
}

init();
