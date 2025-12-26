/**
 * BringYourSub - Popup UI Controller
 * 
 * Handles all popup interactions including:
 * - Tab navigation
 * - Toast notifications
 * - API key validation
 * - Settings management
 * - Subtitle generation
 * 
 * @module popup/popup
 */

// =====================
// DOM Elements
// =====================
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const tabContents = document.querySelectorAll<HTMLElement>('.tab-content');
const tabIndicator = document.querySelector<HTMLElement>('.tab-indicator');

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const toggleKeyBtn = document.getElementById('toggleKey') as HTMLButtonElement;
const testKeyBtn = document.getElementById('testKey') as HTMLButtonElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;

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
const modelSelect = document.getElementById('model') as HTMLSelectElement;
const saveSettingsBtn = document.getElementById('saveSettings') as HTMLButtonElement;

// =====================
// Settings Interface
// =====================
interface Settings {
    openaiApiKey: string;
    targetLanguage: string;
    fontSize: string;
    position: string;
    autoApply: boolean;
    model: string;
}

// =====================
// Toast Notifications
// =====================
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ'
    };

    toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
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

    // Update tab indicator position
    if (tabIndicator) {
        const tabIndex = Array.from(tabs).findIndex(t => t.dataset.tab === tabName);
        tabIndicator.style.transform = `translateX(calc(${tabIndex * 100}% + ${tabIndex * 4}px))`;
    }

    // Show corresponding content
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        if (tabName) switchTab(tabName);
    });
});

// =====================
// API Key Management
// =====================
toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? '🙈' : '👁';
});

testKeyBtn.addEventListener('click', async () => {
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
// Progress Management
// =====================
function updateProgress(stepNumber: number, status: string): void {
    // Update progress bar
    const percentage = (stepNumber / 4) * 100;
    progressFill.style.width = `${percentage}%`;

    // Update steps
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < stepNumber) {
            step.classList.add('completed');
        } else if (index + 1 === stepNumber) {
            step.classList.add('active');
        }
    });

    // Update status text
    statusText.textContent = status;
}

function resetProgress(): void {
    progressFill.style.width = '0%';
    steps.forEach(step => step.classList.remove('active', 'completed'));
    statusText.textContent = 'Initializing...';
}

// =====================
// Subtitle Generation
// =====================
generateBtn.addEventListener('click', async () => {
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

        chrome.runtime.sendMessage({
            action: 'GENERATE_SUBTITLES',
            videoId,
            apiKey,
            language,
            model,
            videoTitle: tab.title || 'Unknown Video'
        }, async (response) => {
            if (response?.error) {
                showToast('Error: ' + response.error, 'error');
                resetUI();
            } else if (response?.subtitles) {
                updateProgress(4, 'Complete!');
                showResult(response.subtitles);
                showToast('Subtitles generated successfully!', 'success');

                // Auto-apply if enabled
                const autoSettings = await chrome.storage.local.get(['autoApply']);
                if (autoSettings.autoApply) {
                    applySubtitlesToVideo(response.subtitles);
                }
            }
        });
    } catch {
        showToast('Unexpected error occurred', 'error');
        resetUI();
    }
});

function showResult(subtitles: string): void {
    progressContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    outputPreview.value = subtitles;
    generateBtn.disabled = false;
}

function resetUI(): void {
    progressContainer.classList.add('hidden');
    generateBtn.disabled = false;
    resetProgress();
}

// =====================
// Result Actions
// =====================
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(outputPreview.value);
        copyBtn.innerHTML = '<span>✓</span> Copied!';
        showToast('Copied to clipboard', 'success');
        setTimeout(() => {
            copyBtn.innerHTML = '<span>📋</span> Copy';
        }, 2000);
    } catch {
        showToast('Failed to copy', 'error');
    }
});

downloadBtn.addEventListener('click', () => {
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

applyBtn.addEventListener('click', () => {
    applySubtitlesToVideo(outputPreview.value);
});

async function applySubtitlesToVideo(subtitles: string): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Get settings
    const settings = await chrome.storage.local.get(['fontSize', 'position']);

    chrome.tabs.sendMessage(tab.id, {
        action: 'APPLY_SUBTITLES',
        subtitles,
        fontSize: settings.fontSize || 'medium',
        position: settings.position || 'bottom'
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
saveSettingsBtn.addEventListener('click', async () => {
    const settings: Partial<Settings> = {
        fontSize: fontSizeSelect.value,
        position: positionSelect.value,
        autoApply: autoApplyCheckbox.checked,
        model: modelSelect.value
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
        'model'
    ]);

    if (data.openaiApiKey) apiKeyInput.value = data.openaiApiKey;
    if (data.targetLanguage) languageSelect.value = data.targetLanguage;
    if (data.fontSize) fontSizeSelect.value = data.fontSize;
    if (data.position) positionSelect.value = data.position;
    if (data.autoApply !== undefined) autoApplyCheckbox.checked = data.autoApply;
    if (data.model) modelSelect.value = data.model;
}

// Save language when changed
languageSelect.addEventListener('change', () => {
    chrome.storage.local.set({ targetLanguage: languageSelect.value });
});

// Save API key when changed
apiKeyInput.addEventListener('change', () => {
    chrome.storage.local.set({ openaiApiKey: apiKeyInput.value });
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

// Initialize
loadSavedData();
