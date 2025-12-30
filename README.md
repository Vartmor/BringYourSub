# BringYourSub - AI YouTube Subtitle Generator

<div align="center">

![BringYourSub Logo](bringyoursub-chrome/icons/icon128.png)

**Generate high-quality, context-aware translated subtitles for YouTube videos using your own OpenAI API key.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com)
[![Firefox](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox&logoColor=white)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Features](#features) | [Installation](#installation) | [Usage](#usage) | [Development](#development)

</div>

---

## Features

### Privacy-First (BYOK)
Your API key stays in your browser. No backend servers, no data collection, no tracking.

### Context-Lock Translation
Unlike sentence-by-sentence translation, BringYourSub analyzes the entire video context first, ensuring:
- Consistent terminology throughout
- Natural-sounding translations
- Proper handling of technical terms

### Whisper Fallback
No captions on the video? No problem. Automatically falls back to OpenAI's Whisper for audio transcription.

### Multi-Language Support
- Turkish
- German
- Spanish
- French
- Italian

### Modern UI
Sleek dark-mode interface with smooth animations and intuitive controls.

---

## Installation

### Prerequisites

Before installing, make sure you have:
- **OpenAI API Key** - Get one from [platform.openai.com](https://platform.openai.com/api-keys)

### Method 1: Pre-built Extension (Recommended)

#### Google Chrome / Chromium-based Browsers (Edge, Brave, Opera, Vivaldi)

1. Download the latest release from the [Releases](https://github.com/Vartmor/bringyoursub/releases) page
2. Extract the ZIP file to a folder
3. Open your browser and go to the extensions page:
   - **Chrome**: Type `chrome://extensions/` in the address bar
   - **Edge**: Type `edge://extensions/` in the address bar
   - **Brave**: Type `brave://extensions/` in the address bar
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the `bringyoursub-chrome/dist` folder
7. The extension icon will appear in your toolbar

#### Mozilla Firefox

1. Download the latest release from the [Releases](https://github.com/Vartmor/bringyoursub/releases) page
2. Extract the ZIP file to a folder
3. Open Firefox and type `about:debugging` in the address bar
4. Click **This Firefox** in the left sidebar
5. Click **Load Temporary Add-on**
6. Navigate to `bringyoursub-firefox/dist` folder and select `manifest.json`
7. The extension icon will appear in your toolbar

> Note: Firefox temporary add-ons are removed when the browser is closed. For permanent installation, the extension needs to be signed by Mozilla.

### Method 2: Build from Source

#### Requirements
- Node.js 18 or higher
- npm (comes with Node.js)

#### Windows

1. Open Command Prompt or PowerShell
2. Clone the repository:
   ```cmd
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Install dependencies:
   ```cmd
   npm install
   ```
4. Build the extensions:
   ```cmd
   npm run build
   ```
5. Follow the browser-specific instructions above to load the extension from:
   - Chrome: `bringyoursub-chrome/dist`
   - Firefox: `bringyoursub-firefox/dist/manifest.json`

#### macOS

1. Open Terminal
2. Clone the repository:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the extensions:
   ```bash
   npm run build
   ```
5. Follow the browser-specific instructions above to load the extension

#### Linux

1. Open Terminal
2. Clone the repository:
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the extensions:
   ```bash
   npm run build
   ```
5. Follow the browser-specific instructions above to load the extension

---

## Usage

1. **Get an OpenAI API Key**
   - Visit [platform.openai.com](https://platform.openai.com/api-keys)
   - Create a new API key

2. **Open a YouTube Video**
   - Navigate to any YouTube video

3. **Click the Extension Icon**
   - Enter your API key
   - Select target language
   - Click "Generate Subtitles"

4. **Export**
   - Copy to clipboard or download as .SRT file

---

## Development

### Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode (development)
npm run watch
```

### Project Structure

```
bringyoursub/
├── bringyoursub-chrome/    # Chrome extension (MV3)
│   ├── extension/
│   │   ├── background/     # Service worker
│   │   ├── content/        # Content scripts
│   │   └── popup/          # Popup UI
│   ├── shared/
│   │   └── ai-core/        # AI pipeline modules
│   └── manifest.json
├── bringyoursub-firefox/   # Firefox extension (MV2)
├── build.mjs               # esbuild configuration
├── package.json
└── tsconfig.json
```

---

## Feedback

Have a suggestion or found a bug? Please open an issue on [GitHub](https://github.com/Vartmor/bringyoursub/issues).

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

---

## Security

This extension uses a **Bring Your Own Key (BYOK)** architecture. Your API key is:
- Stored locally in your browser
- Never sent to any server except OpenAI's API
- Never logged or tracked

See [SECURITY.md](SECURITY.md) for more details.

---

## License

MIT License - Muhammed Koseoglu

See [LICENSE](LICENSE) for more information.

---

## Acknowledgments

- [OpenAI](https://openai.com) for GPT and Whisper APIs

---

<div align="center">
Made for the community
</div>
