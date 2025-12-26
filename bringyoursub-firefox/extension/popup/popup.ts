import { getYouTubeVideoId } from "../../shared/ai-core/transcript.js";

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const statusContainer = document.getElementById('statusContainer') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLParagraphElement;
const resultContainer = document.getElementById('resultContainer') as HTMLDivElement;
const outputPreview = document.getElementById('outputPreview') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement;
const testKeyBtn = document.getElementById('testKey') as HTMLButtonElement;

// Load saved settings
chrome.storage.local.get(['openaiApiKey', 'targetLanguage'], (result) => {
    if (result.openaiApiKey) apiKeyInput.value = result.openaiApiKey;
    if (result.targetLanguage) languageSelect.value = result.targetLanguage;
});

// Save settings when changed
apiKeyInput.addEventListener('change', () => {
    chrome.storage.local.set({ openaiApiKey: apiKeyInput.value });
});

languageSelect.addEventListener('change', () => {
    chrome.storage.local.set({ targetLanguage: languageSelect.value });
});

testKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value;
    if (!key) return alert("Please enter an API key");

    testKeyBtn.disabled = true;
    testKeyBtn.innerText = "Testing...";

    try {
        const response = await fetch("https://api.openai.com/v1/models", {
            headers: { "Authorization": `Bearer ${key}` }
        });
        if (response.ok) alert("API Key is valid!");
        else alert("Invalid API Key");
    } catch (e) {
        alert("Connection error");
    } finally {
        testKeyBtn.disabled = false;
        testKeyBtn.innerText = "Test";
    }
});

generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value;
    const language = languageSelect.value;

    if (!apiKey) return alert("API Key required");

    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url?.includes("youtube.com/watch")) {
        return alert("Please open a YouTube video first");
    }

    const videoId = new URL(tab.url).searchParams.get("v");
    if (!videoId) return alert("Could not find Video ID");

    // Show progress
    statusContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    generateBtn.disabled = true;
    updateStatus("Extracting transcript...");

    try {
        // Send message to background script to handle the pipeline
        chrome.runtime.sendMessage({
            action: "GENERATE_SUBTITLES",
            videoId,
            apiKey,
            language,
            videoTitle: tab.title || "Unknown Video"
        }, (response) => {
            if (response && response.error) {
                alert("Error: " + response.error);
                resetUI();
            } else if (response && response.subtitles) {
                showResult(response.subtitles);
            }
        });
    } catch (error) {
        alert("Unexpected error occurred");
        resetUI();
    }
});

function updateStatus(text: string) {
    statusText.innerText = text;
}

function showResult(subtitles: string) {
    statusContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    outputPreview.value = subtitles;
    generateBtn.disabled = false;
}

function resetUI() {
    statusContainer.classList.add('hidden');
    generateBtn.disabled = false;
}

copyBtn.addEventListener('click', () => {
    outputPreview.select();
    document.execCommand('copy');
    copyBtn.innerText = "Copied!";
    setTimeout(() => copyBtn.innerText = "Copy", 2000);
});

downloadBtn.addEventListener('click', () => {
    const text = outputPreview.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles.srt`;
    a.click();
});

// Listen for progress updates from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "UPDATE_PROGRESS") {
        updateStatus(message.text);
    }
});
