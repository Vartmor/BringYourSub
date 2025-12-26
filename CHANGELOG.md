# Changelog

All notable changes to BringYourSub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-26

### Added

- 🎉 Initial release of BringYourSub
- Core subtitle generation pipeline with context-lock strategy
- Native YouTube transcript extraction
- Whisper API fallback for videos without captions
- Support for multiple languages:
  - Turkish
  - German
  - Spanish
  - French
  - Italian
- Modern dark-mode UI with gradient styling
- API key validation and testing
- Copy to clipboard functionality
- Download as .SRT file
- Chrome extension (Manifest V3)
- Firefox extension (Manifest V2)

### Security

- BYOK (Bring Your Own Key) architecture
- Local-only API key storage
- Direct browser-to-OpenAI communication
- No data collection or analytics

---

## Future Releases

### Planned Features

- [ ] More language support
- [ ] SRT timestamp generation
- [ ] Custom AI model selection (GPT-4, etc.)
- [ ] Batch video processing
- [ ] Subtitle style customization
- [ ] YouTube player overlay integration
