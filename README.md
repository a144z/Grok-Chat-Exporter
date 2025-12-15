# Grok Chat Exporter - Chrome Extension

A powerful Chrome extension to export your x.com Grok AI conversations to Markdown or XML files. Export individual chats or bulk export your entire conversation history with automatic scrolling, caching, and retry mechanisms.

## 📋 Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
  - [Export Current Chat](#export-current-chat)
  - [Export All Chats (Bulk Export)](#export-all-chats-bulk-export)
  - [Export Custom Links](#export-custom-links)
  - [Download Cache](#download-cache)
  - [Debug Tools](#debug-tools)
- [Export Formats](#export-formats)
- [How It Works](#how-it-works)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### Core Features
- **One-Click Export**: Export individual Grok conversations with a single click
- **Bulk Export**: Automatically export all chats from your Grok history page
- **Custom Link Export**: Process a custom list of conversation links
- **Auto-Scrolling**: Automatically scrolls down to load full conversation history (handles virtualized lists)
- **Multiple Formats**: Export to Markdown (.md) or XML (.xml)
- **Smart Caching**: Tracks downloaded chats to avoid duplicates
- **Retry Mechanism**: Automatically retries failed exports up to 3 times
- **Chronological Order**: Messages are sorted correctly (oldest first)
- **Sender Detection**: Accurately distinguishes between User and Grok messages

### Advanced Features
- **Download Cache**: Skips already downloaded chats in bulk operations
- **Link List Export**: Exports all conversation links as a text file
- **Debug Tools**: Built-in debugging to help identify DOM structure issues
- **Error Handling**: Robust error handling with automatic retries
- **Status Updates**: Real-time status updates during bulk operations

## 🚀 Installation

### Prerequisites
- Google Chrome (or Chromium-based browser)
- Access to x.com with a Grok-enabled account

### Installation Steps

1. **Download the Extension**
   ```bash
   git clone https://github.com/yourusername/x-grok-export.git
   cd x-grok-export
   ```

2. **Load in Chrome**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right corner)
   - Click **Load unpacked** (top-left)
   - Select the `x-grok-export` folder

3. **Verify Installation**
   - You should see the "Grok Chat Exporter" extension in your extensions list
   - The extension icon should appear in your Chrome toolbar

## 📖 Usage Guide

### Export Current Chat

Export the currently open Grok conversation:

1. Navigate to a Grok conversation on x.com (URL should contain `conversation=`)
2. Click the **Grok Chat Exporter** icon in your toolbar
3. Select your preferred format (Markdown or XML)
4. Ensure **"Auto-scroll down to load full history"** is checked (recommended)
5. Click **"Export Current Chat"**
6. The extension will:
   - Scroll down to load all messages (if auto-scroll is enabled)
   - Parse all messages
   - Download the file automatically
   - Cache the conversation ID to avoid re-downloading

**File naming**: `grok-chat-{conversationId}-{date}.md` or `.xml`

### Export All Chats (Bulk Export)

Export all conversations from your Grok history page:

1. Navigate to `https://x.com/i/grok` (the Grok history page)
2. Click the **Grok Chat Exporter** icon
3. Select your preferred format
4. Ensure **"Auto-scroll down to load full history"** is checked
5. Click **"Export All Chats"**
6. Confirm the action in the dialog
7. The extension will:
   - Scroll the history page to collect all conversation links
   - Export a text file with all conversation links (`grok-all-conversation-links-{date}.txt`)
   - Filter out already downloaded chats (using cache)
   - Navigate to each chat sequentially
   - Scroll down in each chat to load full history
   - Export each chat as a separate file
   - Retry failed chats automatically (up to 3 times per chat)
   - Show progress updates in the popup

**Important Notes**:
- This process can take a long time depending on the number of chats
- The browser tab will navigate automatically - don't close it
- Failed chats are retried after the main export completes
- Already downloaded chats are automatically skipped

### Export Custom Links

Export specific conversations from a custom list:

1. Click the **Grok Chat Exporter** icon
2. Paste your conversation links into the textarea (one per line)
   - Example:
     ```
     https://x.com/i/grok?conversation=1234567890
     https://x.com/i/grok?conversation=0987654321
     ```
3. Select your preferred format
4. Ensure **"Auto-scroll down to load full history"** is checked
5. Click **"Export Custom Links"**
6. The extension will:
   - Parse all valid conversation links
   - Filter out already downloaded chats
   - Process each chat sequentially
   - Show how many were skipped vs. how many will be exported

**Link Format**: Links can be:
- Full URLs: `https://x.com/i/grok?conversation=1234567890`
- Relative paths: `/i/grok?conversation=1234567890`
- Just the conversation parameter: `conversation=1234567890`

### Download Cache

The extension maintains a cache of downloaded conversation IDs to avoid duplicates:

- **Automatic Caching**: Every successfully exported chat is automatically cached
- **Automatic Skipping**: Bulk and custom exports automatically skip cached chats
- **Clear Cache**: Click **"Clear Download Cache"** to reset the cache and allow re-downloading all chats

**Cache Storage**: The cache is stored in Chrome's local storage and persists across browser sessions.

### Debug Tools

If the extension isn't working correctly, use the debug tools:

1. **Debug Page Structure**: 
   - Click **"Debug Page Structure"**
   - Check the browser console (F12) for detailed DOM analysis
   - Helps identify if selectors need updating

2. **Download Debug Report**:
   - Click **"Download Debug Report"**
   - Downloads a comprehensive text report of the page structure
   - Useful for troubleshooting and reporting issues

## 📄 Export Formats

### Markdown Format

```markdown
# Grok Chat Export
Exported on: 2025/12/15 10:30:00

---

👤 **User**: Your message here

🤖 **Grok**: AI response here

👤 **User**: Another message

🤖 **Grok**: Another response
```

### XML Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<grokChat>
  <metadata>
    <exportDate>2025-12-15T10:30:00Z</exportDate>
  </metadata>
  <messages>
    <message>
      <sender>User</sender>
      <content>Your message here</content>
    </message>
    <message>
      <sender>Grok</sender>
      <content>AI response here</content>
    </message>
  </messages>
</grokChat>
```

## 🔧 How It Works

### Architecture

The extension consists of three main components:

1. **Popup (`popup.html`, `popup.js`)**: User interface for selecting options and triggering exports
2. **Content Script (`content.js`)**: Injected into x.com pages to interact with the DOM
3. **Background Script (`background.js`)**: Service worker for extension lifecycle management

### Export Process

1. **Message Detection**: Uses `data-testid` attributes to identify message elements
   - User messages: Detected via `UserAvatar` proximity
   - Grok messages: Detected via `grok_citation_web_result` and Grok-labeled containers

2. **Scrolling Mechanism**: 
   - Finds the scrollable container (usually `primaryColumn`)
   - Scrolls down incrementally (100ms intervals)
   - Monitors scroll height to detect when all content is loaded
   - Handles virtualized lists by collecting data during scrolling

3. **Message Parsing**:
   - Extracts text from `div[dir="auto"]` and `div[dir="ltr"]` elements
   - Filters out UI noise (buttons, metadata, etc.)
   - Uses `Node.compareDocumentPosition` for chronological sorting
   - Assigns senders based on avatar proximity and pattern matching

4. **Bulk Export Flow**:
   - Collects all conversation links from history page
   - Stores queue in `chrome.storage.local` (persists across navigations)
   - Navigates to each chat sequentially
   - Processes each chat when page loads
   - Retries failed chats automatically
   - Cleans up storage when complete

### Caching System

- Conversation IDs are extracted from URLs (`conversation=(\d+)`)
- Stored in `chrome.storage.local` as an array
- Checked before processing each chat
- Automatically updated after successful exports

## 📁 File Structure

```
x-grok-export/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic and event handlers
├── content.js             # Main content script (DOM interaction)
├── background.js          # Background service worker
└── README.md              # This file
```

### Key Files

- **`manifest.json`**: Defines permissions, content scripts, and extension metadata
- **`content.js`**: Contains all export logic, scrolling, parsing, and bulk export management
- **`popup.js`**: Handles UI interactions and communicates with content script
- **`popup.html`**: Defines the extension popup interface

## 🐛 Troubleshooting

### "Error: Please refresh the page and try again"

**Cause**: Content script not loaded or communication error

**Solutions**:
1. Refresh the x.com page (F5 or Ctrl+R)
2. Reload the extension in `chrome://extensions/`
3. Check browser console (F12) for errors
4. Ensure you're on an x.com page (not blocked by ad blockers)

### "No messages found"

**Cause**: DOM structure changed or wrong page

**Solutions**:
1. Ensure you're on a Grok conversation page (URL contains `conversation=`)
2. Use **"Debug Page Structure"** to analyze the page
3. Check console (F12) for detailed debug output
4. Try scrolling manually to load messages first
5. Report the issue with debug report if selectors need updating

### Bulk Export Stuck

**Cause**: Page load timeout or network issue

**Solutions**:
1. The extension automatically retries failed chats (up to 3 times)
2. Check the popup status for progress updates
3. Failed chats are retried after main export completes
4. If completely stuck, refresh the page and check console
5. Clear cache and try again if needed

### Messages Not Separated Correctly

**Cause**: Sender detection logic may need adjustment

**Solutions**:
1. Check the exported file - messages should alternate (User, Grok, User, Grok...)
2. First message is always assigned to "User"
3. Use debug tools to analyze message structure
4. Report specific cases where separation is incorrect

### Cache Not Working

**Cause**: Storage permission or cache corruption

**Solutions**:
1. Check extension permissions in `chrome://extensions/`
2. Clear cache using **"Clear Download Cache"** button
3. Check browser console for storage errors
4. Ensure `storage` permission is in `manifest.json`

## 🔍 Technical Details

### Permissions

- `activeTab`: Access to current tab
- `scripting`: Inject content scripts
- `downloads`: Download exported files
- `storage`: Persist cache and export queue
- `tabs`: Query active tabs
- `host_permissions`: Access to x.com and twitter.com

### Storage Keys

- `grokExportedChats`: Array of downloaded conversation IDs
- `grokExportQueue`: Array of chats to export
- `grokExportIndex`: Current index in export queue
- `grokExportFormat`: Export format (markdown/xml)
- `grokExportAutoScroll`: Auto-scroll preference
- `grokExportTotal`: Total number of chats to export
- `grokExportRetry`: Retry count for current chat
- `grokExportFailed`: Array of failed chats to retry
- `grokExportRetryMode`: Boolean indicating retry mode

### Selectors

The extension uses various selectors to identify elements:

- **Primary Column**: `[data-testid="primaryColumn"]`
- **User Avatar**: `[data-testid*="UserAvatar"]`
- **Grok Citations**: `[data-testid="grok_citation_web_result"]`
- **Message Text**: `div[dir="auto"]`, `div[dir="ltr"]`
- **Scroll Container**: Element with `overflow-y: scroll/auto`

### Performance

- **Scrolling Speed**: 100ms per scroll cycle (very fast)
- **Page Load Wait**: 500-1000ms delays for content loading
- **Retry Delays**: Automatic retries with exponential backoff
- **Cache Lookup**: O(1) using Set data structure

## ⚠️ Limitations

1. **DOM Dependency**: Relies on x.com's DOM structure - may break if Twitter/X changes their HTML
2. **Single Tab**: Bulk export uses one tab - don't navigate away during export
3. **Rate Limiting**: Very fast exports may hit rate limits (extension includes delays)
4. **Virtualized Lists**: Handles virtualized lists, but may miss messages if scrolling is too fast
5. **Network Dependent**: Requires stable internet connection for page loads
6. **Browser Only**: Works only in Chrome/Chromium browsers

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional export formats (JSON, CSV, PDF)
- Parallel export processing
- Better error messages
- UI improvements
- Selector updates for DOM changes
- Performance optimizations

### Reporting Issues

When reporting issues, please include:

1. Browser version
2. Extension version
3. Steps to reproduce
4. Debug report (use "Download Debug Report")
5. Console errors (F12)
6. Screenshots if relevant

## 📝 License

This project is open source. Feel free to use, modify, and distribute.

## 🙏 Acknowledgments

Built for the x.com Grok community to enable easy conversation export and backup.

---

**Note**: This extension is not affiliated with, endorsed by, or connected to X (formerly Twitter) or xAI. It's an independent tool for users who want to export their Grok conversations.
"# Grok-Chat-Exporter" 
