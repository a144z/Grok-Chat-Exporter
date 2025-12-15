// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Grok Chat Exporter installed');
});

// Handle navigation for bulk export
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'navigate_to_chat') {
    chrome.tabs.update(sender.tab.id, { url: request.url }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open
  }
});

