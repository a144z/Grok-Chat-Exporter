document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const exportCustomBtn = document.getElementById('exportCustomBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const debugBtn = document.getElementById('debugBtn');
  const downloadDebugBtn = document.getElementById('downloadDebugBtn');
  const formatSelect = document.getElementById('format');
  const autoScrollCheck = document.getElementById('autoScroll');
  const customLinksTextarea = document.getElementById('customLinks');
  const statusDiv = document.getElementById('status');

  function showStatus(msg, type) {
    statusDiv.style.display = 'block';
    statusDiv.textContent = msg;
    statusDiv.className = ''; // reset
    statusDiv.classList.add(`status-${type}`);
  }

  exportBtn.addEventListener('click', async () => {
    const format = formatSelect.value;
    const autoScroll = autoScrollCheck.checked;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      showStatus('Please navigate to x.com/i/grok first.', 'error');
      return;
    }

    exportBtn.disabled = true;
    exportBtn.textContent = 'Processing...';
    showStatus('Initializing export...', 'info');

    // Send message to content script
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'start_export',
        config: { format, autoScroll }
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Please refresh the page and try again.', 'error');
          exportBtn.disabled = false;
          exportBtn.textContent = 'Export Chat';
        }
      });
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Chat';
    }
  });

  // Debug button handler
  async function runDebug(downloadReport = false) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      showStatus('Please navigate to x.com first.', 'error');
      return;
    }

    const btn = downloadReport ? downloadDebugBtn : debugBtn;
    btn.disabled = true;
    btn.textContent = downloadReport ? 'Generating...' : 'Debugging...';
    showStatus('Running debug analysis...', 'info');

    try {
      chrome.tabs.sendMessage(tab.id, { action: 'debug_page', downloadReport }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Please refresh the page and try again.', 'error');
          btn.disabled = false;
          btn.textContent = downloadReport ? 'Download Debug Report' : 'Debug Page Structure';
        } else {
          if (downloadReport) {
            showStatus('Debug report downloaded! Also check console (F12).', 'success');
          } else {
            showStatus('Debug complete! Check browser console (F12) for details.', 'success');
          }
          btn.disabled = false;
          btn.textContent = downloadReport ? 'Download Debug Report' : 'Debug Page Structure';
          
          // Also log the summary to popup console
          if (response && response.debugInfo) {
            console.log('Debug Summary:', response.debugInfo);
          }
        }
      });
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = downloadReport ? 'Download Debug Report' : 'Debug Page Structure';
    }
  }

  debugBtn.addEventListener('click', () => runDebug(false));
  downloadDebugBtn.addEventListener('click', () => runDebug(true));

  // Export All Chats button handler
  exportAllBtn.addEventListener('click', async () => {
    const format = formatSelect.value;
    const autoScroll = autoScrollCheck.checked;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      showStatus('Please navigate to x.com/i/grok first.', 'error');
      return;
    }

    // Confirm with user
    const confirmed = confirm(
      'This will export ALL chats in your Grok history.\n\n' +
      'The extension will:\n' +
      '1. Navigate through each chat\n' +
      '2. Scroll down to load full history\n' +
      '3. Export each chat as a separate file\n\n' +
      'This may take a while. Continue?'
    );

    if (!confirmed) return;

    exportAllBtn.disabled = true;
    exportBtn.disabled = true;
    exportAllBtn.textContent = 'Exporting...';
    showStatus('Starting bulk export...', 'info');

    // Send message to content script
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'export_all_chats',
        config: { format, autoScroll }
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Please refresh the page and try again.', 'error');
          exportAllBtn.disabled = false;
          exportBtn.disabled = false;
          exportAllBtn.textContent = 'Export All Chats';
        }
      });
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
      exportAllBtn.disabled = false;
      exportBtn.disabled = false;
      exportAllBtn.textContent = 'Export All Chats';
    }
  });

  // Export Custom Links button handler
  exportCustomBtn.addEventListener('click', async () => {
    const linksText = customLinksTextarea.value.trim();
    if (!linksText) {
      showStatus('Please enter at least one link.', 'error');
      return;
    }

    const links = linksText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (links.length === 0) {
      showStatus('No valid links found.', 'error');
      return;
    }

    const format = formatSelect.value;
    const autoScroll = autoScrollCheck.checked;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }

    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      showStatus('Please navigate to x.com first.', 'error');
      return;
    }

    exportCustomBtn.disabled = true;
    exportBtn.disabled = true;
    exportAllBtn.disabled = true;
    exportCustomBtn.textContent = 'Processing...';
    showStatus(`Processing ${links.length} links...`, 'info');

    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'export_custom_links',
        links: links,
        config: { format, autoScroll }
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Please refresh the page and try again.', 'error');
          exportCustomBtn.disabled = false;
          exportBtn.disabled = false;
          exportAllBtn.disabled = false;
          exportCustomBtn.textContent = 'Export Custom Links';
        }
      });
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
      exportCustomBtn.disabled = false;
      exportBtn.disabled = false;
      exportAllBtn.disabled = false;
      exportCustomBtn.textContent = 'Export Custom Links';
    }
  });

  // Clear Cache button handler
  clearCacheBtn.addEventListener('click', async () => {
    const confirmed = confirm('Clear download cache? This will allow re-downloading all chats. Continue?');
    if (!confirmed) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showStatus('Error: No active tab found.', 'error');
      return;
    }

    try {
      chrome.tabs.sendMessage(tab.id, { action: 'clear_cache' }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('Error: Please refresh the page and try again.', 'error');
        } else {
          showStatus('Download cache cleared!', 'success');
        }
      });
    } catch (e) {
      showStatus('Error: ' + e.message, 'error');
    }
  });

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'export_status') {
      if (request.done) {
        exportBtn.disabled = false;
        exportAllBtn.disabled = false;
        exportCustomBtn.disabled = false;
        exportBtn.textContent = 'Export Current Chat';
        exportAllBtn.textContent = 'Export All Chats';
        exportCustomBtn.textContent = 'Export Custom Links';
        showStatus(request.status, request.status.includes('Error') ? 'error' : 'success');
      } else {
        showStatus(request.status, 'info');
      }
    }
  });
});
