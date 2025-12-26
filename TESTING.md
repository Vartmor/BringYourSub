# Testing Guide

This document provides test scenarios for BringYourSub extension.

## Prerequisites

- Firefox or Chrome browser
- Valid OpenAI API key with credits
- Extension loaded in developer mode

---

## Manual Test Scenarios

### 1. Extension Loading

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Load extension in Firefox | No errors in console |
| 1.2 | Click extension icon | Popup opens with 3 tabs |
| 1.3 | Switch between tabs | Smooth animation, content changes |

### 2. API Key Validation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Enter invalid key, click Test | Red ✗, error toast "Invalid API Key" |
| 2.2 | Enter valid key, click Test | Green ✓, success toast "API Key is valid!" |
| 2.3 | Toggle show/hide button | Key visibility toggles |
| 2.4 | Close and reopen popup | Key is saved |

### 3. Short Video (< 5 min)

**Test video:** Any YouTube video under 5 minutes with captions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Open YouTube video | Extension detects video |
| 3.2 | Click Generate Subtitles | Progress bar appears |
| 3.3 | Wait for completion | SRT output with timestamps |
| 3.4 | Click Copy | Toast: "Copied to clipboard" |
| 3.5 | Click Download .SRT | File downloads |
| 3.6 | Click Apply to Video | Subtitles appear on video |

### 4. Long Video (> 30 min)

**Test video:** Any YouTube video over 30 minutes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Click Generate | Warning: "Long video detected" |
| 4.2 | Watch progress | Shows "Part X/Y" updates |
| 4.3 | Wait for completion | All chunks translated |
| 4.4 | Check SRT output | Proper timestamps throughout |

### 5. Video Without Captions (Whisper Fallback)

**Test video:** A video without auto-generated captions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Click Generate | Status: "Using Whisper..." |
| 5.2 | Check for warning | Cost warning displayed |
| 5.3 | Wait for completion | Transcription + translation done |

### 6. Error Handling

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Generate with invalid key | Error: "Invalid API Key" |
| 6.2 | Generate on non-YouTube page | Error: "Please open a YouTube video" |
| 6.3 | Generate with rate limit | Error: "Rate limit exceeded" |

### 7. Settings Persistence

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | Change language to German | Setting saved |
| 7.2 | Change font size to Large | Setting saved |
| 7.3 | Toggle Auto-apply ON | Setting saved |
| 7.4 | Close/reopen extension | All settings preserved |

### 8. YouTube Overlay

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Apply subtitles to video | Overlay appears |
| 8.2 | Play video | Subtitles sync with time |
| 8.3 | Seek to different position | Subtitles update |
| 8.4 | Enter fullscreen | Overlay still visible |
| 8.5 | YouTube native CC hidden | No duplicate subtitles |

### 9. About Section

| Step | Action | Expected Result |
|------|--------|-----------------|
| 9.1 | Open About tab | Version v1.0.0 shown |
| 9.2 | Check privacy badges | 3 trust badges visible |
| 9.3 | Click GitHub link | Opens repo in new tab |
| 9.4 | Click Privacy link | Opens PRIVACY.md |

---

## SRT Format Verification

Generated SRT should follow this format:

```srt
1
00:00:00,000 --> 00:00:05,123
First subtitle line.

2
00:00:05,123 --> 00:00:10,456
Second subtitle line.
```

**Checklist:**
- [ ] Sequential numbering starts at 1
- [ ] Timestamps use comma (not period) for milliseconds
- [ ] Arrow separator is ` --> ` (with spaces)
- [ ] Each entry separated by blank line
- [ ] No mid-sentence breaks

---

## Running Unit Tests

```bash
npm test
```

## Test Coverage

```bash
npm run test:coverage
```
