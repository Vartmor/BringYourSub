# BringYourSub – AI YouTube Subtitle Generator

<div align="center">

![BringYourSub Logo](bringyoursub-chrome/icons/icon128.png)

**Generate high-quality, context-aware translated subtitles for YouTube videos using your own OpenAI API key.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com)
[![Firefox](https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox&logoColor=white)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing)

</div>

---

## ✨ Features

### 🔐 Privacy-First (BYOK)
Your API key stays in your browser. No backend servers, no data collection, no tracking.

### 🧠 Context-Lock Translation
Unlike sentence-by-sentence translation, BringYourSub analyzes the entire video context first, ensuring:
- Consistent terminology throughout
- Natural-sounding translations
- Proper handling of technical terms

### 🎙️ Whisper Fallback
No captions on the video? No problem. Automatically falls back to OpenAI's Whisper for audio transcription.

### 🌍 Multi-Language Support
- Turkish 🇹🇷
- German 🇩🇪
- Spanish 🇪🇸
- French 🇫🇷
- Italian 🇮🇹

### 🎨 Modern UI
Sleek dark-mode interface with smooth animations and intuitive controls.

---

## 📦 Installation

### From Source (Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Vartmor/bringyoursub.git
   cd bringyoursub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extensions:**
   ```bash
   npm run build
   ```

4. **Load in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `bringyoursub-chrome/dist`

5. **Load in Firefox:**
   - Go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `bringyoursub-firefox/dist/manifest.json`

---

## 🚀 Usage

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

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm

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

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) first.

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 🔒 Security

This extension uses a **Bring Your Own Key (BYOK)** architecture. Your API key is:
- Stored locally in your browser
- Never sent to any server except OpenAI's API
- Never logged or tracked

See [SECURITY.md](SECURITY.md) for more details.

---

## 📜 License

MIT © Muhammed Köseoğlu

See [LICENSE](LICENSE) for more information.

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT and Whisper APIs
- All our [contributors](https://github.com/Vartmor/bringyoursub/contributors)

---

<div align="center">
Made with ❤️ for the community
</div>
