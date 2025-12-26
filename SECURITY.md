# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## API Key Security

BringYourSub is designed with a **"Bring Your Own Key" (BYOK)** architecture:

- ✅ API keys are stored **locally** in your browser's extension storage
- ✅ API keys are **never** sent to any server other than OpenAI's official API
- ✅ All API communication happens **directly** between your browser and OpenAI
- ✅ **No analytics** or data collection of any kind

### Best Practices

1. **Never share your API key** with anyone
2. **Set usage limits** in your OpenAI dashboard
3. **Rotate your key** periodically
4. **Monitor usage** for unexpected charges

## Reporting a Vulnerability

If you discover a security vulnerability in BringYourSub, please report it by:

1. **Email**: Create a private issue or contact the maintainers directly
2. **Do NOT** open a public GitHub issue for security vulnerabilities

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix/Patch**: Depends on severity (critical issues prioritized)

## Security Features

### Content Security

- The extension only runs on YouTube (`https://www.youtube.com/*`)
- Minimal permissions requested (storage, activeTab, scripting)
- No background data collection

### Data Flow

```
Your Browser → OpenAI API → Your Browser
    ↑                           ↓
    └── All data stays local ───┘
```

No intermediary servers. No data retention. Full privacy.
