// Grok Chat Exporter - Content Script
console.log('[GrokExporter] Content script loaded');

// Utility to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Cache management for downloaded chats
 */
const CACHE_KEY = 'grokExportedChats';

async function getDownloadedChats() {
  const data = await chrome.storage.local.get(CACHE_KEY);
  const cached = data[CACHE_KEY] || [];
  return new Set(cached); // Convert array to Set for easy checking
}

async function markAsDownloaded(conversationId) {
  const data = await chrome.storage.local.get(CACHE_KEY);
  const cached = data[CACHE_KEY] || [];
  if (!cached.includes(conversationId)) {
    cached.push(conversationId);
    await chrome.storage.local.set({ [CACHE_KEY]: cached });
    console.log(`[GrokExporter] Marked chat ${conversationId} as downloaded`);
  }
}

async function isDownloaded(conversationId) {
  const downloaded = await getDownloadedChats();
  return downloaded.has(conversationId);
}

async function clearDownloadCache() {
  await chrome.storage.local.remove(CACHE_KEY);
  console.log('[GrokExporter] Download cache cleared');
}

// Selectors for x.com Grok interface
const SELECTORS = {
  cell: '[data-testid="cellInnerDiv"]',
  text: '[data-testid="tweetText"]',
  // X often puts aria-labels on divs or SVGs for accessibility
  grokLabel: '[aria-label*="Grok"]',
  userLabel: '[data-testid="User-Name"]',
  // The main scroll container is often the window or a specific div in a modal
  scrollableDiv: 'div[style*="overflow-y: scroll"], div[style*="overflow-y: auto"]' 
};

/**
 * Comprehensive debugging function to analyze page structure
 */
function debugPageStructure() {
  const debugInfo = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    dataTestIds: {},
    potentialSelectors: {},
    domStructure: {},
    foundElements: {}
  };

  console.log('=== GROK EXPORTER DEBUG INFO ===');
  console.log('URL:', debugInfo.url);
  console.log('Title:', debugInfo.title);
  console.log('Timestamp:', debugInfo.timestamp);

  // Find all elements with data-testid attributes
  const allTestIds = new Set();
  document.querySelectorAll('[data-testid]').forEach(el => {
    const testId = el.getAttribute('data-testid');
    allTestIds.add(testId);
    if (!debugInfo.dataTestIds[testId]) {
      debugInfo.dataTestIds[testId] = {
        count: 0,
        sampleHTML: '',
        sampleText: ''
      };
    }
    debugInfo.dataTestIds[testId].count++;
    if (debugInfo.dataTestIds[testId].count === 1) {
      debugInfo.dataTestIds[testId].sampleHTML = el.outerHTML.substring(0, 500);
      debugInfo.dataTestIds[testId].sampleText = el.innerText.substring(0, 200);
    }
  });

  console.log('\n=== ALL DATA-TESTID ATTRIBUTES ===');
  console.table(debugInfo.dataTestIds);

  // Try current selectors
  console.log('\n=== TESTING CURRENT SELECTORS ===');
  const cellElements = document.querySelectorAll(SELECTORS.cell);
  const textElements = document.querySelectorAll(SELECTORS.text);
  console.log(`Found ${cellElements.length} elements with selector: ${SELECTORS.cell}`);
  console.log(`Found ${textElements.length} elements with selector: ${SELECTORS.text}`);

  if (cellElements.length > 0) {
    console.log('\n=== SAMPLE CELL ELEMENT ===');
    console.log('First cell HTML:', cellElements[0].outerHTML.substring(0, 1000));
    console.log('First cell text:', cellElements[0].innerText.substring(0, 500));
    console.log('First cell classes:', cellElements[0].className);
    console.log('First cell parent:', cellElements[0].parentElement?.tagName, cellElements[0].parentElement?.className);
  }

  if (textElements.length > 0) {
    console.log('\n=== SAMPLE TEXT ELEMENT ===');
    console.log('First text HTML:', textElements[0].outerHTML.substring(0, 500));
    console.log('First text content:', textElements[0].innerText);
  }

  // Look for Grok-specific indicators
  console.log('\n=== LOOKING FOR GROK INDICATORS ===');
  const grokElements = document.querySelectorAll('[aria-label*="Grok"], [aria-label*="grok"]');
  console.log(`Found ${grokElements.length} elements with "Grok" in aria-label`);
  if (grokElements.length > 0) {
    grokElements.forEach((el, idx) => {
      if (idx < 3) {
        console.log(`Grok element ${idx + 1}:`, el.outerHTML.substring(0, 300));
      }
    });
  }

  // Look for text containing "Grok"
  const textWithGrok = Array.from(document.querySelectorAll('*')).filter(el => 
    el.innerText && el.innerText.includes('Grok') && el.children.length === 0
  );
  console.log(`Found ${textWithGrok.length} text nodes containing "Grok"`);

  // Try alternative selectors
  console.log('\n=== TESTING ALTERNATIVE SELECTORS ===');
  const alternatives = [
    '[data-testid="tweet"]',
    '[data-testid="conversation"]',
    '[data-testid="message"]',
    '[role="article"]',
    '[role="listitem"]',
    'article',
    '[dir="auto"]',
    'div[lang]'
  ];

  alternatives.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Selector "${selector}": Found ${elements.length} elements`);
      debugInfo.potentialSelectors[selector] = elements.length;
    }
  });

  // Find scrollable containers
  console.log('\n=== SCROLLABLE CONTAINERS ===');
  const scrollable = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
           el.scrollHeight > el.clientHeight;
  });
  console.log(`Found ${scrollable.length} scrollable containers`);
  scrollable.forEach((el, idx) => {
    if (idx < 5) {
      console.log(`Scrollable ${idx + 1}:`, el.tagName, el.className, `scrollHeight: ${el.scrollHeight}, clientHeight: ${el.clientHeight}`);
    }
  });

  // Look for common chat patterns
  console.log('\n=== LOOKING FOR CHAT PATTERNS ===');
  const articles = document.querySelectorAll('article');
  console.log(`Found ${articles.length} <article> elements`);
  if (articles.length > 0) {
    console.log('First article:', articles[0].outerHTML.substring(0, 800));
  }

  // Check primaryColumn structure (main chat area)
  const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (primaryColumn) {
    console.log('\n=== PRIMARY COLUMN STRUCTURE ===');
    console.log('Primary column found:', primaryColumn);
    const primaryChildren = Array.from(primaryColumn.querySelectorAll('div')).filter(div => {
      const text = div.innerText.trim();
      return text.length > 10;
    });
    console.log(`Found ${primaryChildren.length} divs with text inside primaryColumn`);
    if (primaryChildren.length > 0) {
      console.log('Sample divs from primaryColumn:');
      primaryChildren.slice(0, 5).forEach((div, idx) => {
        console.log(`\nDiv ${idx + 1}:`);
        console.log('Text:', div.innerText.substring(0, 200));
        console.log('Classes:', div.className);
        console.log('HTML:', div.outerHTML.substring(0, 500));
      });
    }
  }

  // Look for Grok-specific elements
  const grokCitations = document.querySelectorAll('[data-testid="grok_citation_web_result"]');
  console.log(`\n=== GROK CITATIONS ===`);
  console.log(`Found ${grokCitations.length} grok citation elements`);
  if (grokCitations.length > 0) {
    grokCitations.forEach((el, idx) => {
      if (idx < 2) {
        console.log(`Citation ${idx + 1}:`, el.outerHTML.substring(0, 500));
        console.log('Parent:', el.parentElement?.outerHTML.substring(0, 300));
      }
    });
  }

  // Look for message-like structures - divs with text that might be messages
  const divsWithText = Array.from(document.querySelectorAll('div')).filter(div => {
    const text = div.innerText.trim();
    return text.length > 20 && text.length < 5000 && div.children.length > 0;
  });
  console.log(`\nFound ${divsWithText.length} divs with substantial text content`);
  
  // Look for patterns that might indicate messages
  console.log('\n=== ANALYZING TEXT DIVS FOR MESSAGE PATTERNS ===');
  const messageCandidates = divsWithText.filter(div => {
    const text = div.innerText.trim();
    // Look for divs that might be messages (have substantial text, not just UI elements)
    const hasUserAvatar = div.querySelector('[data-testid*="UserAvatar"]');
    const hasGrokIndicator = div.innerHTML.includes('Grok') || div.querySelector('[aria-label*="Grok"]');
    const isInPrimaryColumn = primaryColumn && primaryColumn.contains(div);
    return isInPrimaryColumn && text.length > 10;
  });
  
  console.log(`Found ${messageCandidates.length} potential message divs in primaryColumn`);
  if (messageCandidates.length > 0) {
    messageCandidates.slice(0, 10).forEach((div, idx) => {
      console.log(`\n--- Potential Message ${idx + 1} ---`);
      console.log('Text:', div.innerText.substring(0, 300));
      console.log('Classes:', div.className);
      console.log('Has UserAvatar:', !!div.querySelector('[data-testid*="UserAvatar"]'));
      console.log('Has Grok indicator:', div.innerHTML.includes('Grok') || !!div.querySelector('[aria-label*="Grok"]'));
      console.log('HTML structure:', div.outerHTML.substring(0, 800));
    });
  }

  // Create a summary object to send back
  const summary = {
    url: debugInfo.url,
    dataTestIds: Object.keys(debugInfo.dataTestIds).sort(),
    cellCount: cellElements.length,
    textCount: textElements.length,
    grokCount: grokElements.length,
    articleCount: articles.length,
    scrollableCount: scrollable.length,
    potentialSelectors: debugInfo.potentialSelectors
  };

  console.log('\n=== DEBUG SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  // Create a detailed text report
  let report = '=== GROK EXPORTER DEBUG REPORT ===\n\n';
  report += `URL: ${debugInfo.url}\n`;
  report += `Title: ${debugInfo.title}\n`;
  report += `Timestamp: ${debugInfo.timestamp}\n\n`;
  report += `=== DATA-TESTID ATTRIBUTES (${Object.keys(debugInfo.dataTestIds).length} found) ===\n`;
  Object.keys(debugInfo.dataTestIds).sort().forEach(testId => {
    const info = debugInfo.dataTestIds[testId];
    report += `\n[${testId}]: ${info.count} elements\n`;
    report += `Sample text: ${info.sampleText.substring(0, 100)}\n`;
  });
  report += `\n=== CURRENT SELECTOR RESULTS ===\n`;
  report += `${SELECTORS.cell}: ${cellElements.length} found\n`;
  report += `${SELECTORS.text}: ${textElements.length} found\n`;
  report += `\n=== ALTERNATIVE SELECTORS ===\n`;
  Object.entries(debugInfo.potentialSelectors).forEach(([sel, count]) => {
    report += `${sel}: ${count} elements\n`;
  });
  report += `\n=== INSTRUCTIONS ===\n`;
  report += `1. Copy this entire report\n`;
  report += `2. Share it to help identify the correct selectors\n`;
  report += `3. Look for data-testid attributes that appear near chat messages\n`;
  report += `4. Check the browser console (F12) for more detailed HTML samples\n`;

  console.log('\n=== FULL DEBUG REPORT (Copy this) ===');
  console.log(report);

  // Store report in window for easy access
  window.grokExporterDebugReport = report;

  return { summary, report };
}

/**
 * Finds the scrollable container for the chat.
 * X.com uses virtualized lists, often on the window or a specific column div.
 */
async function getScrollContainer() {
  // Try to find primaryColumn first (main chat area)
  const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (primaryColumn) {
    // Check if primaryColumn itself is scrollable
    const style = window.getComputedStyle(primaryColumn);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && 
        primaryColumn.scrollHeight > primaryColumn.clientHeight) {
      return primaryColumn;
    }
    
    // Otherwise, find scrollable parent
    let parent = primaryColumn.parentElement;
    while (parent) {
      const parentStyle = window.getComputedStyle(parent);
      if ((parentStyle.overflowY === 'auto' || parentStyle.overflowY === 'scroll') && 
          parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
      if (parent === document.body) break;
    }
  }
  
  // Fallback: check for cells
  const cells = document.querySelectorAll(SELECTORS.cell);
  if (cells.length > 0) {
    let parent = cells[0].parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
      if (parent === document.body) return window;
    }
  }
  return window; // Default fallback
}

/**
 * Scrolls the history page to load all chat links.
 * The history sidebar might be in a separate scrollable container.
 */
async function scrollHistoryPageToLoadAllLinks() {
  console.log('[GrokExporter] Scrolling history page to load all chat links...');
  
  // Find the scrollable container - could be window or a sidebar container
  let scrollContainer = window;
  let scrollElement = null;
  
  // Look for a scrollable sidebar container (often has overflow-y: auto/scroll)
  const scrollableElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
           el.scrollHeight > el.clientHeight;
  });
  
  // Prefer a container that has conversation links in it
  for (const el of scrollableElements) {
    const hasGrokLinks = el.querySelectorAll('a[href*="/i/grok?conversation="]').length > 0;
    if (hasGrokLinks) {
      scrollElement = el;
      console.log('[GrokExporter] Found scrollable sidebar container with Grok links');
      break;
    }
  }
  
  // If no specific container found, use window
  if (!scrollElement) {
    scrollElement = window;
  }
  
  const isWindow = scrollElement === window;
  const getScrollTop = () => isWindow ? window.scrollY : scrollElement.scrollTop;
  const getScrollHeight = () => isWindow ? document.body.scrollHeight : scrollElement.scrollHeight;
  const getClientHeight = () => isWindow ? window.innerHeight : scrollElement.clientHeight;
  const scrollToBottom = () => {
    if (isWindow) {
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  };
  
  let lastHeight = getScrollHeight();
  let lastLinkCount = document.querySelectorAll('a[href*="/i/grok?conversation="]').length;
  let retries = 0;
  const MAX_RETRIES = 5; // Increased retries

  while (true) {
    // Scroll to bottom
    scrollToBottom();
    await sleep(100); // Wait for content to load (ultra-fast scrolling)

    const newHeight = getScrollHeight();
    const newLinkCount = document.querySelectorAll('a[href*="/i/grok?conversation="]').length;
    
    console.log(`[GrokExporter] Height: ${newHeight}, Links found: ${newLinkCount}`);
    
    // Check if height changed OR if new links were loaded
    if (newHeight === lastHeight && newLinkCount === lastLinkCount) {
      retries++;
      if (retries >= MAX_RETRIES) {
        console.log('[GrokExporter] No more links loading.');
        break;
      }
    } else {
      retries = 0;
      lastHeight = newHeight;
      lastLinkCount = newLinkCount;
      console.log(`[GrokExporter] Loaded more content. New height: ${newHeight}, Links: ${newLinkCount}`);
    }
  }
  
  // Final scroll to make sure we're at the bottom
  scrollToBottom();
  await sleep(1000);
}

/**
 * Finds all chat conversation links in the history.
 * Returns array of URLs or clickable elements.
 * Searches comprehensively to ensure all links are found.
 */
function findAllChatLinks() {
  const links = [];
  const seenIds = new Set();
  
  // Look for links that point to grok conversations
  // Try multiple selectors to catch all possible link formats
  const selectors = [
    'a[href*="/i/grok?conversation="]',
    'a[href*="/i/grok"]',
    '[href*="conversation="]',
    'a[href*="grok"]'
  ];
  
  const allLinks = new Set();
  
  // Collect links using all selectors
  selectors.forEach(selector => {
    try {
      const foundLinks = document.querySelectorAll(selector);
      foundLinks.forEach(link => allLinks.add(link));
    } catch (e) {
      console.warn(`[GrokExporter] Selector failed: ${selector}`, e);
    }
  });
  
  console.log(`[GrokExporter] Found ${allLinks.size} total link elements`);
  
  // Process all found links
  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Check if it's a conversation link
    if (href.includes('conversation=') && (href.includes('/i/grok') || href.includes('grok'))) {
      // Extract conversation ID
      const match = href.match(/conversation=(\d+)/);
      if (match) {
        const conversationId = match[1];
        // Avoid duplicates by conversation ID
        if (!seenIds.has(conversationId)) {
          seenIds.add(conversationId);
          // Normalize URL
          let fullUrl = href;
          if (!href.startsWith('http')) {
            if (href.startsWith('/')) {
              fullUrl = `https://x.com${href}`;
            } else {
              fullUrl = `https://x.com/${href}`;
            }
          }
          
          links.push({
            element: link,
            href: fullUrl,
            conversationId: conversationId
          });
        }
      }
    }
  });
  
  // Also check for links in data attributes or other places
  // Some sites use data-href or similar
  const elementsWithData = document.querySelectorAll('[data-href*="conversation="], [data-url*="conversation="]');
  elementsWithData.forEach(el => {
    const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url');
    if (dataHref && dataHref.includes('conversation=')) {
      const match = dataHref.match(/conversation=(\d+)/);
      if (match) {
        const conversationId = match[1];
        if (!seenIds.has(conversationId)) {
          seenIds.add(conversationId);
          let fullUrl = dataHref;
          if (!fullUrl.startsWith('http')) {
            fullUrl = `https://x.com${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
          }
          links.push({
            element: el,
            href: fullUrl,
            conversationId: conversationId
          });
        }
      }
    }
  });
  
  // Sort by position in DOM (oldest first, typically)
  links.sort((a, b) => {
    const posA = a.element.compareDocumentPosition(b.element);
    if (posA & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1; // a comes before b
    } else if (posA & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1; // a comes after b
    }
    return 0;
  });
  
  console.log(`[GrokExporter] Found ${links.length} unique chat conversation links`);
  return links;
}

/**
 * Scrolls to the bottom of the container to load older messages.
 * Grok chats load older messages when scrolling down.
 */
async function scrollToBottom(container) {
  const isWindow = container === window;
  const getScrollTop = () => isWindow ? window.scrollY : container.scrollTop;
  const getScrollHeight = () => isWindow ? document.body.scrollHeight : container.scrollHeight;
  const getClientHeight = () => isWindow ? window.innerHeight : container.clientHeight;
  const scrollToBottomPos = () => {
    if (isWindow) {
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  console.log('[GrokExporter] Starting scroll to bottom...');
  let lastHeight = getScrollHeight();
  let retries = 0;
  const MAX_RETRIES = 3; // Stop if height doesn't change after 3 attempts

  while (true) {
    // Scroll to bottom
    scrollToBottomPos();
    
    // Wait for content to load (ultra-fast scrolling)
    await sleep(100); 

    const newHeight = getScrollHeight();
    const currentScrollTop = getScrollTop();
    const clientHeight = getClientHeight();
    const maxScroll = newHeight - clientHeight;
    const distanceFromBottom = Math.abs(currentScrollTop - maxScroll);

    // Check if we've reached the bottom and no new content loaded
    if (newHeight === lastHeight && distanceFromBottom < 50) {
      retries++;
      console.log(`[GrokExporter] No height change. Retry ${retries}/${MAX_RETRIES}`);
      if (retries >= MAX_RETRIES) {
        console.log('[GrokExporter] Reached bottom or stopped loading.');
        break;
      }
    } else {
      retries = 0; // Reset retries if we successfully loaded more content
      lastHeight = newHeight;
      console.log(`[GrokExporter] Loaded more content. New height: ${newHeight}, scrollTop: ${currentScrollTop}, maxScroll: ${maxScroll}`);
    }
  }
}

/**
 * Parses messages from the DOM.
 * Updated to work with Grok chat structure and properly separate user/Grok messages.
 */
function parseMessages() {
  const messages = [];
  
  // First, try to find messages in primaryColumn
  const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
  if (!primaryColumn) {
    console.warn('[GrokExporter] primaryColumn not found');
    return messages;
  }

  console.log('[GrokExporter] Parsing messages from primaryColumn...');

  // Strategy: Find individual message blocks by looking for text nodes and their containers
  // We'll process user and Grok messages separately to avoid combining them
  
  // Find all user avatars to locate user messages
  const userAvatars = Array.from(primaryColumn.querySelectorAll('[data-testid*="UserAvatar"]'));
  console.log(`[GrokExporter] Found ${userAvatars.length} user avatars`);
  
  // Find all Grok citations to locate Grok messages
  const grokCitations = Array.from(primaryColumn.querySelectorAll('[data-testid="grok_citation_web_result"]'));
  console.log(`[GrokExporter] Found ${grokCitations.length} Grok citations`);

  // Find all text divs with dir="auto" - these are often individual messages
  const autoDivs = Array.from(primaryColumn.querySelectorAll('div[dir="auto"], div[dir="ltr"]'));
  console.log(`[GrokExporter] Found ${autoDivs.length} divs with dir="auto" or "ltr"`);

  // Process all messages - use pattern-based detection (User, Grok, User, Grok...)
  // Helper to get a unique key for an element based on its position
  const getPosKey = (rect) => `${Math.round(rect.top)}-${Math.round(rect.left)}`;

  // Find ALL potential message text blocks first
  const allTextDivs = Array.from(primaryColumn.querySelectorAll('div[dir="auto"], div[dir="ltr"], span[dir="auto"]'));
  
  const candidateMessages = [];
  
  allTextDivs.forEach(div => {
    const text = div.innerText.trim();
    
    // Skip if too short or UI noise
    if (text.length < 2 || text === 'Auto' || text === 'See new posts') return;
    if (text.match(/^\d+\s+(web\s+pages?|sources?|citations?)$/i)) return;
    if (['Copy', 'Retry', 'Edit', 'Share', 'Like', 'Reply'].includes(text)) return;

    const rect = div.getBoundingClientRect();
    const key = getPosKey(rect);
    
    // Check if there's a user avatar in the same message row/bubble
    let hasUserAvatar = false;
    
    // Walk up from the text div to find message containers
    let current = div;
    for (let i = 0; i < 8 && current; i++) {
      // Check if this container or its immediate children/siblings have a user avatar
      const avatarInContainer = current.querySelector('[data-testid*="UserAvatar"]');
      
      if (avatarInContainer) {
        // Check if the avatar is close to this text div (same message bubble)
        const avatarRect = avatarInContainer.getBoundingClientRect();
        const textRect = div.getBoundingClientRect();
        
        // If they're close vertically (within 150px), they're in the same message
        if (Math.abs(avatarRect.top - textRect.top) < 150) {
          hasUserAvatar = true;
          break;
        }
      }
      
      // Also check siblings at this level
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        for (const sibling of siblings) {
          if (sibling === current) continue;
          const siblingAvatar = sibling.querySelector('[data-testid*="UserAvatar"]');
          if (siblingAvatar) {
            const avatarRect = siblingAvatar.getBoundingClientRect();
            const textRect = div.getBoundingClientRect();
            if (Math.abs(avatarRect.top - textRect.top) < 150) {
              hasUserAvatar = true;
              break;
            }
          }
        }
        if (hasUserAvatar) break;
      }
      
      current = current.parentElement;
      if (!current || current === primaryColumn) break;
    }
    
    // Add to candidates
    candidateMessages.push({
      element: div,
      text: text,
      key: key,
      hasUserAvatar: hasUserAvatar,
      top: rect.top
    });
  });
  
  // Remove duplicates (keep most specific container for each position)
  const uniqueMessages = new Map();
  candidateMessages.forEach(msg => {
    if (!uniqueMessages.has(msg.key) || 
        msg.element.children.length < uniqueMessages.get(msg.key).element.children.length) {
      uniqueMessages.set(msg.key, msg);
    }
  });
  
  // Convert to array and sort by position (top to bottom = oldest to newest)
  const sortedMessages = Array.from(uniqueMessages.values());
  sortedMessages.sort((a, b) => {
    if (Math.abs(a.top - b.top) < 10) {
      // Same row, sort by left position
      return a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left;
    }
    return a.top - b.top;
  });
  
  // Apply pattern: User, Grok, User, Grok... (first is always User)
  const parsedMessages = [];
  sortedMessages.forEach((msg, index) => {
    // If it has a user avatar, it's definitely User
    // Otherwise, use the pattern: odd index (0, 2, 4...) = User, even index (1, 3, 5...) = Grok
    let sender = 'User';
    
    if (msg.hasUserAvatar) {
      sender = 'User';
    } else {
      // Use alternating pattern: index 0 = User, index 1 = Grok, index 2 = User, etc.
      sender = (index % 2 === 0) ? 'User' : 'Grok';
    }
    
    parsedMessages.push({
      element: msg.element,
      text: msg.text,
      sender: sender
    });
    
    console.log(`[GrokExporter] Message ${index + 1}: ${sender} - ${msg.text.substring(0, 50)}...`);
  });
  
  const userMessages = new Map();
  const grokMessages = new Map();
  
  // Separate into user and grok maps for compatibility with existing code
  parsedMessages.forEach((msg, index) => {
    const rect = msg.element.getBoundingClientRect();
    const key = getPosKey(rect);
    if (msg.sender === 'User') {
      userMessages.set(key, msg);
    } else {
      grokMessages.set(key, msg);
    }
  });
  
  console.log(`[GrokExporter] Found ${parsedMessages.length} messages (${userMessages.size} user, ${grokMessages.size} Grok)`);

  // Extract clean messages
  for (const msgData of parsedMessages) {
    let text = msgData.text;
    
    // Filter out UI noise
    const lines = text.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             trimmed !== 'Auto' && 
             trimmed !== 'See new posts' &&
             !trimmed.match(/^\d+$/) &&
             !trimmed.match(/^@\w+$/) &&
             !trimmed.match(/^\d+\s+(web\s+pages?|sources?|citations?)$/i) &&
             !['Copy', 'Retry', 'Edit', 'Share'].includes(trimmed); 
    });
    
    text = lines.join('\n').trim();
    
    // Skip if no meaningful text
    if (!text || text.length < 2) continue;

    // Get timestamp if available
    const timeNode = msgData.element.querySelector('time') || 
                    msgData.element.closest('[data-testid*="UserAvatar"]')?.querySelector('time');
    const timestamp = timeNode ? timeNode.getAttribute('datetime') : new Date().toISOString();

    messages.push({ 
      sender: msgData.sender, 
      text: text, 
      timestamp: timestamp 
    });
    
    console.log(`[GrokExporter] Extracted ${msgData.sender} message (${text.length} chars): ${text.substring(0, 50)}...`);
  }

  // Log summary
  const userCount = messages.filter(m => m.sender === 'User').length;
  const grokCount = messages.filter(m => m.sender === 'Grok').length;
  console.log(`[GrokExporter] Total messages extracted: ${messages.length} (User: ${userCount}, Grok: ${grokCount})`);
  
  if (userCount === 0 && messages.length > 0) {
    console.warn('[GrokExporter] WARNING: No user messages found! Only Grok responses detected.');
  }
  
  return messages;
}

function convertToMarkdown(messages) {
  let md = '# Grok Chat Export\n\n';
  md += `Exported on: ${new Date().toLocaleString()}\n\n---\n\n`;
  
  messages.forEach(msg => {
    const role = msg.sender === 'Grok' ? '🤖 **Grok**' : '👤 **User**';
    md += `${role}:\n\n${msg.text}\n\n---\n\n`;
  });
  return md;
}

function convertToXML(messages) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<conversation>\n';
  xml += `  <meta>\n    <exportDate>${new Date().toISOString()}</exportDate>\n  </meta>\n`;
  messages.forEach(msg => {
    xml += `  <message>\n    <sender>${escapeXml(msg.sender)}</sender>\n    <content>${escapeXml(msg.text)}</content>\n    <timestamp>${msg.timestamp}</timestamp>\n  </message>\n`;
  });
  xml += '</conversation>';
  return xml;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function download(content, format, filename = null) {
  const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `grok-chat-${new Date().toISOString().slice(0,10)}.${format === 'markdown' ? 'md' : 'xml'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a list of conversation links as a text file
 */
function downloadLinksList(links, filename = null) {
  const content = links.map(link => link.href).join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `grok-all-links-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single chat conversation.
 * Returns the messages array.
 */
async function exportSingleChat(format, autoScroll) {
  if (autoScroll) {
    chrome.runtime.sendMessage({ action: 'export_status', status: 'Scrolling to load full history...', done: false });
    const container = await getScrollContainer();
    await scrollToBottom(container);
  }
  
  chrome.runtime.sendMessage({ action: 'export_status', status: 'Parsing messages...', done: false });
  await sleep(1000);
  
  const messages = parseMessages();
  return messages;
}

/**
 * Collects all chat links from history page.
 * Handles virtualized lists by collecting links WHILE scrolling.
 */
async function collectAllChatLinks() {
  console.log('[GrokExporter] Collecting all chat links from history page...');
  
  // Storage for all unique links found during scrolling
  const allLinksMap = new Map(); // ID -> { href, conversationId }
  
  // Helper to scan for links in the current DOM state
  const scanLinks = () => {
    // Look for links that point to grok conversations
    // Use multiple selectors
    const selectors = [
      'a[href*="/i/grok?conversation="]',
      'a[href*="/i/grok/"]' // sometimes simple path
    ];
    
    let foundCount = 0;
    
    selectors.forEach(selector => {
      const links = document.querySelectorAll(selector);
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Extract ID
        let id = null;
        const match = href.match(/conversation=(\d+)/);
        if (match) {
          id = match[1];
        } else if (href.includes('/i/grok/')) {
           // Maybe path based ID? /i/grok/12345
           const parts = href.split('/');
           const potentialId = parts[parts.length - 1];
           if (/^\d+$/.test(potentialId)) id = potentialId;
        }
        
        if (id && !allLinksMap.has(id)) {
          allLinksMap.set(id, {
            conversationId: id,
            href: href.startsWith('http') ? href : `https://x.com${href}`
          });
          foundCount++;
        }
      });
    });
    
    return foundCount;
  };
  
  // Find the scrollable container for history
  // Look for a container that has multiple Grok conversation links
  // We need to find the sidebar specifically
  let scrollContainer = window;
  
  // Initial scan
  scanLinks();
  
  // Try to find the specific scrollable element that contains the links
  const potentialContainers = Array.from(document.querySelectorAll('*')).filter(el => {
    // Must be scrollable
    const style = window.getComputedStyle(el);
    const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && 
                         el.scrollHeight > el.clientHeight;
    if (!isScrollable) return false;
    
    // Must contain Grok links
    // Check if it contains at least one of the links we found
    const hasLinks = el.querySelectorAll('a[href*="/i/grok?conversation="]').length > 0;
    return hasLinks;
  });
  
  if (potentialContainers.length > 0) {
    // Pick the one with the most links, or the deepest one in DOM
    // Usually the most specific container is best
    // Sort by number of links
    potentialContainers.sort((a, b) => 
      b.querySelectorAll('a[href*="/i/grok?conversation="]').length - 
      a.querySelectorAll('a[href*="/i/grok?conversation="]').length
    );
    scrollContainer = potentialContainers[0];
    console.log('[GrokExporter] Found specific scrollable history container:', scrollContainer);
  } else {
    console.log('[GrokExporter] No specific scroll container found, using window.');
  }
  
  // Scroll loop
  let retries = 0;
  const MAX_RETRIES = 15; // High retry count for thousands of items
  let noNewLinksCount = 0;
  
  console.log('[GrokExporter] Starting scroll loop to collect links...');
  
  while (true) {
    // Scroll to bottom of container
    if (scrollContainer === window) {
      window.scrollTo(0, document.body.scrollHeight);
    } else {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
    
    await sleep(100); // Wait for load (ultra-fast scrolling)
    
    // Scan for new links
    const newFound = scanLinks();
    const totalCount = allLinksMap.size;
    
    if (newFound > 0) {
      console.log(`[GrokExporter] Collected ${newFound} new links. Total: ${totalCount}`);
      retries = 0;
      noNewLinksCount = 0;
    } else {
      retries++;
      noNewLinksCount++;
      console.log(`[GrokExporter] No new links found. Retry ${retries}/${MAX_RETRIES}. Total: ${totalCount}`);
      
      // Try a "wiggle" scroll to trigger virtualization if stuck
      if (scrollContainer !== window) {
         scrollContainer.scrollTop = scrollContainer.scrollHeight - 100;
         await sleep(100);
         scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
      
      if (retries >= MAX_RETRIES) {
        console.log('[GrokExporter] Finished collecting links (max retries reached).');
        break;
      }
    }
    
    // Safety break for extremely large histories (optional, maybe 5000?)
    if (totalCount > 10000) {
        console.log('[GrokExporter] Reached safety limit of 10000 chats.');
        break;
    }
  }
  
  const finalLinks = Array.from(allLinksMap.values());
  console.log(`[GrokExporter] Collection complete. Found ${finalLinks.length} unique chats.`);
  return finalLinks;
}

/**
 * Exports all chats in the history.
 * This function processes chats one by one.
 */
async function exportAllChats(format, autoScroll) {
  console.log('[GrokExporter] Starting bulk export of all chats...');
  
  // Check if we're on the history page
  const currentUrl = window.location.href;
  const isHistoryPage = currentUrl.includes('/i/grok') && !currentUrl.includes('conversation=');
  
  if (!isHistoryPage) {
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: 'Please navigate to https://x.com/i/grok first (the history page).', 
      done: true 
    });
    return;
  }
  
  // Collect all chat links first
  chrome.runtime.sendMessage({ action: 'export_status', status: 'Scrolling history to load all chats...', done: false });
  const chatLinks = await collectAllChatLinks();
  
  if (chatLinks.length === 0) {
    chrome.runtime.sendMessage({ action: 'export_status', status: 'No chats found. Make sure you\'re on the Grok history page.', done: true });
    return;
  }
  
  // Download the list of all links
  downloadLinksList(chatLinks, `grok-all-conversation-links-${new Date().toISOString().slice(0,10)}.txt`);
  console.log(`[GrokExporter] Downloaded list of ${chatLinks.length} conversation links`);
  
  // Filter out already downloaded chats
  const downloaded = await getDownloadedChats();
  const filteredLinks = chatLinks.filter(link => !downloaded.has(link.conversationId));
  const skippedCount = chatLinks.length - filteredLinks.length;
  
  if (skippedCount > 0) {
    console.log(`[GrokExporter] Skipping ${skippedCount} already downloaded chats`);
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: `Found ${chatLinks.length} chats. ${skippedCount} already downloaded, ${filteredLinks.length} to export...`, 
      done: false 
    });
  } else {
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: `Found ${chatLinks.length} chats. Starting export...`, 
      done: false 
    });
  }
  
  if (filteredLinks.length === 0) {
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: `All ${chatLinks.length} chats are already downloaded!`, 
      done: true 
    });
    return;
  }
  
  // Store the chat links and current index in a way that persists across page navigations
  // We'll use chrome.storage for this
  await chrome.storage.local.set({
    grokExportQueue: filteredLinks.map(l => ({ href: l.href, conversationId: l.conversationId })),
    grokExportIndex: 0,
    grokExportFormat: format,
    grokExportAutoScroll: autoScroll,
    grokExportTotal: filteredLinks.length,
    grokExportFailed: [] // Track failed chats for retry
  });
  
  // Start processing the first chat
  if (chatLinks.length > 0) {
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: `Processing chat 1/${chatLinks.length}...`, 
      done: false 
    });
    
    // Navigate to first chat
    window.location.href = chatLinks[0].href;
  }
}

/**
 * Processes a single chat from the export queue.
 * This is called when we detect we're on a conversation page.
 */
async function processQueuedChat() {
  const data = await chrome.storage.local.get([
    'grokExportQueue', 
    'grokExportIndex', 
    'grokExportFormat', 
    'grokExportAutoScroll',
    'grokExportTotal',
    'grokExportRetry',
    'grokExportFailed',
    'grokExportRetryMode'
  ]);
  
  if (!data.grokExportQueue || data.grokExportIndex === undefined) {
    return; // Not in export mode
  }
  
  const queue = data.grokExportQueue;
  const index = data.grokExportIndex;
  const format = data.grokExportFormat || 'markdown';
  const autoScroll = data.grokExportAutoScroll !== false;
  const total = data.grokExportTotal || queue.length;
  const retries = data.grokExportRetry || 0;
  const failedChats = data.grokExportFailed || [];
  const isRetryMode = data.grokExportRetryMode || false;
  
  if (index >= queue.length) {
    // Check if we need to retry failed chats
    if (!isRetryMode && failedChats.length > 0) {
      console.log(`[GrokExporter] Main export complete. Retrying ${failedChats.length} failed chats...`);
      chrome.runtime.sendMessage({ 
        action: 'export_status', 
        status: `Main export complete. Retrying ${failedChats.length} failed chats...`, 
        done: false 
      });
      
      // Switch to retry mode
      await chrome.storage.local.set({
        grokExportQueue: failedChats,
        grokExportIndex: 0,
        grokExportFormat: format,
        grokExportAutoScroll: autoScroll,
        grokExportTotal: failedChats.length,
        grokExportRetry: 0,
        grokExportFailed: [],
        grokExportRetryMode: true
      });
      
      // Navigate to first failed chat
      if (failedChats.length > 0) {
        window.location.href = failedChats[0].href;
      }
      return;
    }
    
    // All done (including retries)!
    const finalStatus = isRetryMode 
      ? `Complete! Exported all chats (including ${failedChats.length} retried).`
      : `Complete! Exported ${total} chats.`;
    
    chrome.storage.local.remove([
      'grokExportQueue', 
      'grokExportIndex', 
      'grokExportFormat', 
      'grokExportAutoScroll', 
      'grokExportTotal', 
      'grokExportRetry',
      'grokExportFailed',
      'grokExportRetryMode'
    ]);
    
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: finalStatus, 
      done: true 
    });
    return;
  }
  
  const chat = queue[index];
  const chatNum = index + 1;
  const retryMsg = retries > 0 ? ` (Retry ${retries}/3)` : '';
  
  // Check if already downloaded (skip if so)
  const alreadyDownloaded = await isDownloaded(chat.conversationId);
  if (alreadyDownloaded && !isRetryMode) {
    console.log(`[GrokExporter] Chat ${chatNum} (${chat.conversationId}) already downloaded. Skipping.`);
    // Move to next chat
    const nextIndex = index + 1;
    await chrome.storage.local.set({ grokExportIndex: nextIndex, grokExportRetry: 0 });
    
    if (nextIndex < queue.length) {
      chrome.runtime.sendMessage({ 
        action: 'export_status', 
        status: `Skipping already downloaded chat. Processing ${nextIndex + 1}/${total}...`, 
        done: false 
      });
      window.location.href = queue[nextIndex].href;
    }
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'export_status', 
    status: `Exporting chat ${chatNum}/${total}${retryMsg}...`, 
    done: false 
  });
  
  try {
    // Wait for content to load
    // If not loaded within 5 seconds, reload
    const waitForContent = async () => {
      for (let i = 0; i < 50; i++) { // 50 * 100ms = 5 seconds
        const primaryColumn = document.querySelector('[data-testid="primaryColumn"]');
        // Check if there are any message-like elements
        const hasMessages = primaryColumn && (
          primaryColumn.querySelector('[data-testid*="UserAvatar"]') || 
          primaryColumn.querySelector('[data-testid="grok_citation_web_result"]') ||
          primaryColumn.innerText.length > 50
        );
        
        if (hasMessages) return true;
        await sleep(100);
      }
      return false;
    };
    
    const loaded = await waitForContent();
    
    if (!loaded) {
      if (retries < 3) {
        console.log(`[GrokExporter] Chat ${chatNum} failed to load. Retrying...`);
        chrome.runtime.sendMessage({ action: 'export_status', status: `Chat not loaded. Reloading page...`, done: false });
        await chrome.storage.local.set({ grokExportRetry: retries + 1 });
        window.location.reload();
        return;
      } else {
        console.error(`[GrokExporter] Chat ${chatNum} failed to load after 3 retries. Marking for retry.`);
        // Add to failed list
        if (!failedChats.find(f => f.conversationId === chat.conversationId)) {
          failedChats.push(chat);
          await chrome.storage.local.set({ grokExportFailed: failedChats, grokExportRetry: 0 });
        }
      }
    } else {
      // Content loaded, reset retries
      if (retries > 0) {
        await chrome.storage.local.set({ grokExportRetry: 0 });
      }
      
      // Export this chat
      const messages = await exportSingleChat(format, autoScroll);
      
      if (messages.length > 0) {
        const output = format === 'markdown' ? convertToMarkdown(messages) : convertToXML(messages);
        const filename = `grok-chat-${chat.conversationId}-${new Date().toISOString().slice(0,10)}.${format === 'markdown' ? 'md' : 'xml'}`;
        download(output, format, filename);
        
        // Mark as downloaded in cache
        await markAsDownloaded(chat.conversationId);
        
        console.log(`[GrokExporter] Exported chat ${chatNum} with ${messages.length} messages`);
        
        // Remove from failed list if it was there (in case we're retrying)
        const updatedFailed = failedChats.filter(f => f.conversationId !== chat.conversationId);
        if (updatedFailed.length !== failedChats.length) {
          await chrome.storage.local.set({ grokExportFailed: updatedFailed });
        }
        
        // Small delay between downloads
        await sleep(500);
      } else {
        console.warn(`[GrokExporter] No messages found in chat ${chatNum}. Marking for retry.`);
        // Add to failed list if not already there
        if (!failedChats.find(f => f.conversationId === chat.conversationId)) {
          failedChats.push(chat);
          await chrome.storage.local.set({ grokExportFailed: failedChats });
        }
      }
    }
    
    // Move to next chat
    const nextIndex = index + 1;
    await chrome.storage.local.set({ grokExportIndex: nextIndex, grokExportRetry: 0 });
    
    if (nextIndex < queue.length) {
      // Navigate to next chat
      const statusMsg = isRetryMode 
        ? `Retrying failed chat ${nextIndex + 1}/${total}...`
        : `Processing chat ${nextIndex + 1}/${total}...`;
      chrome.runtime.sendMessage({ 
        action: 'export_status', 
        status: statusMsg, 
        done: false 
      });
      window.location.href = queue[nextIndex].href;
    } else {
      // This will trigger the retry logic in the next check
      // The function will be called again and detect index >= queue.length
      // Then it will check for failed chats and retry them
    }
    
  } catch (error) {
    console.error(`[GrokExporter] Error exporting chat ${chatNum}:`, error);
    chrome.runtime.sendMessage({ 
      action: 'export_status', 
      status: `Error exporting chat ${chatNum}: ${error.message}. Will retry later...`, 
      done: false 
    });
    
    // Add to failed list
    const currentFailed = data.grokExportFailed || [];
    if (!currentFailed.find(f => f.conversationId === chat.conversationId)) {
      currentFailed.push(chat);
      await chrome.storage.local.set({ grokExportFailed: currentFailed });
    }
    
    // Continue to next chat even on error
    const nextIndex = index + 1;
    await chrome.storage.local.set({ grokExportIndex: nextIndex, grokExportRetry: 0 });
    
    if (nextIndex < queue.length) {
      window.location.href = queue[nextIndex].href;
    }
  }
}

// Check if we're on a conversation page and should process queued export
// Use DOMContentLoaded to ensure page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkForQueuedExport);
} else {
  checkForQueuedExport();
}

function checkForQueuedExport() {
  const currentUrl = window.location.href;
  if (currentUrl.includes('conversation=')) {
    // We're on a conversation page, check if we have a queued export
    chrome.storage.local.get(['grokExportQueue', 'grokExportIndex']).then(data => {
      if (data.grokExportQueue && data.grokExportIndex !== undefined) {
        // We have a queued export, process it
        setTimeout(() => {
          processQueuedChat();
        }, 1000); // Wait a bit for page to load
      }
    }).catch(err => {
      console.error('[GrokExporter] Error checking for queued export:', err);
    });
  }
}

// Main Listener
console.log('[GrokExporter] Registering message listener');
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[GrokExporter] Received message:', request.action);
  
  if (request.action === 'start_export') {
    (async () => {
      try {
        console.log('[GrokExporter] Starting export...');
        const debugSummary = debugPageStructure();
        
        const messages = await exportSingleChat(request.config.format, request.config.autoScroll);
        
        if (messages.length === 0) {
          const finalDebug = debugPageStructure();
          chrome.runtime.sendMessage({ 
            action: 'export_status', 
            status: 'No messages found. Check console (F12) for debug info.', 
            done: true,
            debugInfo: finalDebug
          });
          
          console.error('[GrokExporter] ============================================');
          console.error('[GrokExporter] NO MESSAGES FOUND');
          console.error('[GrokExporter] Please check the debug output above.');
          console.error('[GrokExporter] Copy the console output and share it to help identify correct selectors.');
          console.error('[GrokExporter] ============================================');
          return;
        }

        console.log(`[GrokExporter] Found ${messages.length} messages.`);
        const output = request.config.format === 'markdown' ? convertToMarkdown(messages) : convertToXML(messages);
        download(output, request.config.format);
        
        // Mark as downloaded in cache
        const currentUrl = window.location.href;
        const match = currentUrl.match(/conversation=(\d+)/);
        if (match) {
          await markAsDownloaded(match[1]);
        }
        
        chrome.runtime.sendMessage({ action: 'export_status', status: `Success! Exported ${messages.length} messages.`, done: true });
      } catch (e) {
        console.error('[GrokExporter] Error:', e);
        chrome.runtime.sendMessage({ action: 'export_status', status: 'Error: ' + e.message, done: true });
      }
    })();
    sendResponse({ received: true });
  } else if (request.action === 'export_all_chats') {
    (async () => {
      try {
        await exportAllChats(request.config.format, request.config.autoScroll);
      } catch (e) {
        console.error('[GrokExporter] Bulk export error:', e);
        chrome.runtime.sendMessage({ action: 'export_status', status: 'Error: ' + e.message, done: true });
      }
    })();
    sendResponse({ received: true });
    return true;
  } else if (request.action === 'export_custom_links') {
    (async () => {
      try {
        const links = request.links || [];
        if (links.length === 0) {
          chrome.runtime.sendMessage({ action: 'export_status', status: 'No links provided.', done: true });
          return;
        }
        
        // Parse links and extract conversation IDs
        const chatLinks = [];
        const seenIds = new Set();
        
        links.forEach(link => {
          const href = link.trim();
          if (!href) return;
          
          // Normalize URL
          let fullUrl = href;
          if (!href.startsWith('http')) {
            fullUrl = href.startsWith('/') ? `https://x.com${href}` : `https://x.com/${href}`;
          }
          
          // Extract conversation ID
          const match = fullUrl.match(/conversation=(\d+)/);
          if (match) {
            const conversationId = match[1];
            if (!seenIds.has(conversationId)) {
              seenIds.add(conversationId);
              chatLinks.push({ href: fullUrl, conversationId: conversationId });
            }
          }
        });
        
        if (chatLinks.length === 0) {
          chrome.runtime.sendMessage({ action: 'export_status', status: 'No valid conversation links found.', done: true });
          return;
        }
        
        // Filter out already downloaded
        const downloaded = await getDownloadedChats();
        const filteredLinks = chatLinks.filter(link => !downloaded.has(link.conversationId));
        const skippedCount = chatLinks.length - filteredLinks.length;
        
        chrome.runtime.sendMessage({ 
          action: 'export_status', 
          status: `Found ${chatLinks.length} links. ${skippedCount} already downloaded, ${filteredLinks.length} to export...`, 
          done: false 
        });
        
        if (filteredLinks.length === 0) {
          chrome.runtime.sendMessage({ 
            action: 'export_status', 
            status: `All ${chatLinks.length} chats are already downloaded!`, 
            done: true 
          });
          return;
        }
        
        // Store queue and start processing
        await chrome.storage.local.set({
          grokExportQueue: filteredLinks,
          grokExportIndex: 0,
          grokExportFormat: request.config.format,
          grokExportAutoScroll: request.config.autoScroll,
          grokExportTotal: filteredLinks.length,
          grokExportFailed: []
        });
        
        // Navigate to first chat
        window.location.href = filteredLinks[0].href;
        
      } catch (e) {
        console.error('[GrokExporter] Custom links export error:', e);
        chrome.runtime.sendMessage({ action: 'export_status', status: 'Error: ' + e.message, done: true });
      }
    })();
    sendResponse({ received: true });
    return true;
  } else if (request.action === 'clear_cache') {
    (async () => {
      try {
        await clearDownloadCache();
        sendResponse({ success: true });
      } catch (e) {
        console.error('[GrokExporter] Clear cache error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  } else if (request.action === 'debug_page') {
    const debugResult = debugPageStructure();
    
    if (request.downloadReport) {
      const blob = new Blob([debugResult.report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grok-debug-report-${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    sendResponse({ success: true, debugInfo: debugResult.summary, report: debugResult.report });
    return true;
  }
  return true; // Keep channel open
});
