# Contributing to BringYourSub

First off, thank you for considering contributing to BringYourSub! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/bringyoursub.git
   cd bringyoursub
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/bringyoursub.git
   ```

## Development Setup

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- Chrome or Firefox browser for testing

### Installation

```bash
# Install dependencies
npm install

# Build the extensions
npm run build

# Watch for changes during development
npm run watch
```

### Loading the Extension

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `bringyoursub-chrome/dist`

**Firefox:**
1. Go to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `bringyoursub-firefox/dist/manifest.json`

## Making Changes

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

2. **Make your changes** following our [Style Guidelines](#style-guidelines)

3. **Test your changes** by loading the extension in your browser

4. **Commit your changes** with a clear message:
   ```bash
   git commit -m "feat: add new language support"
   # or
   git commit -m "fix: resolve transcript parsing issue"
   ```

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Ensure the build passes**: `npm run build`
3. **Push to your fork** and submit a Pull Request
4. **Fill out the PR template** with all relevant information
5. **Wait for review** - we'll get back to you as soon as possible!

### PR Title Format

```
feat: add support for Portuguese subtitles
fix: handle videos without captions gracefully
docs: update installation instructions
refactor: simplify chunking algorithm
```

## Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Add JSDoc comments to all public functions
- Avoid `any` types - use proper interfaces instead
- Use `const` for variables that aren't reassigned
- Use descriptive variable and function names

### Code Formatting

```typescript
// Good
export async function getTranscript(videoId: string): Promise<string | null> {
    // ...
}

// Avoid
export async function gt(id: any) {
    // ...
}
```

### File Organization

```
bringyoursub-chrome/
├── extension/
│   ├── background/    # Service worker
│   ├── content/       # Content scripts
│   └── popup/         # Popup UI
└── shared/
    └── ai-core/       # Shared AI pipeline
```

## Questions?

Feel free to open an issue if you have questions or need clarification on anything!

---

Thank you for your contribution! 💜
