/**
 * Soal Scanner AI - Content Script
 * Floating menu dan overlay system untuk scanning soal
 * 
 * @author Dany Pratmanto
 * @contact WhatsApp: 08974041777
 * @version 2.0.0
 * @description Draggable floating menu dengan keyboard shortcuts
 */

// Content script untuk floating menu scan
(function() {
  'use strict';
  
  // Prevent multiple injection
  if (window.soalScannerLoaded) {
    return;
  }

  // Check jika halaman ini compatible
  const currentUrl = window.location.href;
  if (currentUrl.startsWith('chrome://') || 
      currentUrl.startsWith('chrome-extension://') || 
      currentUrl.startsWith('edge://') || 
      currentUrl.startsWith('about:') ||
      currentUrl.startsWith('moz-extension://')) {
    console.log('Soal Scanner: Skipping system page');
    return;
  }

  // Check extension context validity
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('Soal Scanner: Extension context invalid on load');
      return;
    }
  } catch (error) {
    console.log('Soal Scanner: Extension context check failed:', error);
    return;
  }
  
  window.soalScannerLoaded = true;

  // Security bypass system
  let securityBypassEnabled = false;
  let originalEventHandlers = new Map();
  let blockedSelectors = [];

  let floatingMenu = null;
  let isSnipping = false;
  let selectionBox = null;
  let overlay = null;
  let startX, startY, endX, endY;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let apiKeysReady = false;
  let apiKeyCount = 0;
  let shortcuts = {
    scanFull: 'KeyS',
    snipping: 'KeyA',
    toggleMenu: 'KeyF'
  };

  // 🛡️ SECURITY BYPASS FUNCTIONS
  function enableSecurityBypass() {
    if (securityBypassEnabled) return;
    
    console.log('🛡️ Enabling security bypass...');
    securityBypassEnabled = true;
    
    // 1. Override Right-Click Block
    document.addEventListener('contextmenu', forceEnableContextMenu, true);
    
    // 2. Override Text Selection Block  
    document.addEventListener('selectstart', forceEnableSelection, true);
    document.addEventListener('mousedown', forceEnableSelection, true);
    
    // 3. Override Copy/Paste Block
    document.addEventListener('copy', forceEnableCopy, true);
    document.addEventListener('paste', forceEnablePaste, true);
    document.addEventListener('cut', forceEnableCut, true);
    
    // 4. Override Keyboard Shortcuts Block
    document.addEventListener('keydown', forceEnableKeyboard, true);
    
    // 5. Remove CSS that blocks selection
    removeSelectionBlockCSS();
    
    // 6. Override drag and drop blocks
    document.addEventListener('dragstart', forceEnableDrag, true);
    
    // 7. Override print screen blocks
    document.addEventListener('keyup', forceEnablePrintScreen, true);
    
    // 8. Override developer tools blocks
    window.addEventListener('beforeunload', forceEnableDevTools, true);
    
    // 9. Remove oncontextmenu attributes
    removeContextMenuBlocks();
    
    // 10. Override iframe restrictions
    overrideIframeRestrictions();
    
    console.log('✅ Security bypass enabled - All restrictions removed!');
  }

  function disableSecurityBypass() {
    if (!securityBypassEnabled) return;
    
    console.log('🛡️ Disabling security bypass...');
    securityBypassEnabled = false;
    
    // Remove our override listeners
    document.removeEventListener('contextmenu', forceEnableContextMenu, true);
    document.removeEventListener('selectstart', forceEnableSelection, true);
    document.removeEventListener('mousedown', forceEnableSelection, true);
    document.removeEventListener('copy', forceEnableCopy, true);
    document.removeEventListener('paste', forceEnablePaste, true);
    document.removeEventListener('cut', forceEnableCut, true);
    document.removeEventListener('keydown', forceEnableKeyboard, true);
    document.removeEventListener('dragstart', forceEnableDrag, true);
    document.removeEventListener('keyup', forceEnablePrintScreen, true);
    window.removeEventListener('beforeunload', forceEnableDevTools, true);
    
    console.log('❌ Security bypass disabled');
  }

  function forceEnableContextMenu(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Don't prevent default - allow context menu to show
    console.log('🛡️ Right-click enabled on:', e.target);
  }

  function forceEnableSelection(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Don't prevent default - allow text selection
    
    // Force enable text selection on target element
    const target = e.target;
    target.style.userSelect = 'text';
    target.style.webkitUserSelect = 'text';
    target.style.mozUserSelect = 'text';
    target.style.msUserSelect = 'text';
    
    console.log('🛡️ Text selection enabled on:', target);
  }

  function forceEnableCopy(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🛡️ Copy operation enabled');
  }

  function forceEnablePaste(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🛡️ Paste operation enabled');
  }

  function forceEnableCut(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🛡️ Cut operation enabled');
  }

  function forceEnableKeyboard(e) {
    // Allow important keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'a' || 
          e.key === 's' || e.key === 'p' || e.key === 'u' || e.key === 'f' ||
          e.key === 'r' || e.key === 'F12') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('🛡️ Keyboard shortcut enabled:', e.key);
      }
    }
    
    // Allow F12, F5, etc.
    if (e.key === 'F12' || e.key === 'F5' || e.key === 'F11') {
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🛡️ Function key enabled:', e.key);
    }
  }

  function forceEnableDrag(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('🛡️ Drag operation enabled');
  }

  function forceEnablePrintScreen(e) {
    if (e.key === 'PrintScreen' || e.key === 'F12') {
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('🛡️ Print screen / Dev tools enabled');
    }
  }

  function forceEnableDevTools(e) {
    // Override any beforeunload handlers that try to prevent dev tools
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function removeSelectionBlockCSS() {
    // Inject CSS to override selection blocks
    const bypassCSS = document.createElement('style');
    bypassCSS.id = 'soal-scanner-bypass-css';
    bypassCSS.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
        -webkit-tap-highlight-color: initial !important;
      }
      
      /* Override pointer-events blocks */
      *[style*="pointer-events: none"] {
        pointer-events: auto !important;
      }
      
      /* Override visibility blocks */
      *[style*="visibility: hidden"] {
        visibility: visible !important;
      }
      
      /* Override display blocks for context menus */
      .no-right-click,
      .disable-selection,
      .no-copy,
      .protected {
        pointer-events: auto !important;
        user-select: text !important;
      }
    `;
    
    if (!document.getElementById('soal-scanner-bypass-css')) {
      document.head.appendChild(bypassCSS);
      console.log('🛡️ Selection block CSS removed');
    }
  }

  function removeContextMenuBlocks() {
    // Remove oncontextmenu="return false" attributes
    const elementsWithContextBlock = document.querySelectorAll('[oncontextmenu]');
    elementsWithContextBlock.forEach(element => {
      element.removeAttribute('oncontextmenu');
      console.log('🛡️ Removed oncontextmenu block from:', element);
    });
    
    // Remove onselectstart="return false" attributes
    const elementsWithSelectBlock = document.querySelectorAll('[onselectstart]');
    elementsWithSelectBlock.forEach(element => {
      element.removeAttribute('onselectstart');
      console.log('🛡️ Removed onselectstart block from:', element);
    });
    
    // Remove ondragstart="return false" attributes
    const elementsWithDragBlock = document.querySelectorAll('[ondragstart]');
    elementsWithDragBlock.forEach(element => {
      element.removeAttribute('ondragstart');
      console.log('🛡️ Removed ondragstart block from:', element);
    });
  }

  function overrideIframeRestrictions() {
    // Override iframe restrictions that might block functionality
    const iframes = document.querySelectorAll('iframe[sandbox]');
    iframes.forEach(iframe => {
      const currentSandbox = iframe.getAttribute('sandbox');
      if (!currentSandbox.includes('allow-scripts')) {
        iframe.setAttribute('sandbox', currentSandbox + ' allow-scripts allow-same-origin');
        console.log('🛡️ Modified iframe sandbox restrictions');
      }
    });
  }

  function checkAndApplyBypass() {
    // Auto-detect if page has security restrictions
    const hasRightClickBlock = document.querySelector('[oncontextmenu*="false"]') || 
                              document.querySelector('[oncontextmenu*="return false"]');
    const hasSelectionBlock = document.querySelector('[onselectstart*="false"]') ||
                             document.querySelector('[style*="user-select: none"]');
    const hasCopyBlock = document.querySelector('[oncopy*="false"]') ||
                        document.querySelector('[oncut*="false"]');
    
    if (hasRightClickBlock || hasSelectionBlock || hasCopyBlock) {
      console.log('🛡️ Security restrictions detected, applying bypass...');
      enableSecurityBypass();
      return true;
    }
    
    return false;
  }

  // Load settings dan shortcuts
  chrome.storage.sync.get(['floatingMenuEnabled', 'customShortcuts', 'geminiApiKeys', 'securityBypassEnabled'], function(result) {
    const menuEnabled = result.floatingMenuEnabled !== false; // Default true
    const bypassEnabled = result.securityBypassEnabled !== false; // Default true
    
    if (result.customShortcuts) {
      shortcuts = { ...shortcuts, ...result.customShortcuts };
    }
    
    // Check if API keys are available
    const apiKeys = result.geminiApiKeys || [];
    apiKeysReady = apiKeys.length > 0;
    apiKeyCount = apiKeys.length;
    
    console.log(`🔄 Initial API key check: ${apiKeyCount} keys found, ready: ${apiKeysReady}`);
    
    if (menuEnabled) {
      createFloatingMenu();
      updateFloatingMenuStatus();
    }
    
    // Apply security bypass if enabled
    if (bypassEnabled) {
      // Check if page needs bypass or apply auto-detection
      setTimeout(() => {
        checkAndApplyBypass();
      }, 1000); // Wait for page to fully load
      
      // Also apply immediately if we can detect restrictions
      enableSecurityBypass();
    }
  });

  // Listen untuk pesan dari background dan popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'ping') {
      sendResponse({ status: 'pong' });
      return true;
    }

    if (request.action === 'apiKeysReady') {
      apiKeysReady = true;
      apiKeyCount = request.keyCount || 0;
      updateFloatingMenuStatus();
      console.log(`✅ API Keys ready: ${apiKeyCount} keys available`);
      sendResponse({ status: 'keys_acknowledged' });
      return true;
    }
    
    if (request.action === 'startSnipping') {
      if (!apiKeysReady) {
        showError('API Keys belum siap. Tambahkan API Key di Settings terlebih dahulu.');
        sendResponse({ status: 'no_api_keys' });
        return true;
      }
      startSnippingMode();
      sendResponse({ status: 'snipping_started' });
      return true;
    }

    if (request.action === 'scanFullPage') {
      if (!apiKeysReady) {
        showError('API Keys belum siap. Tambahkan API Key di Settings terlebih dahulu.');
        sendResponse({ status: 'no_api_keys' });
        return true;
      }
      triggerFullScan();
      sendResponse({ status: 'full_scan_started' });
      return true;
    }

    if (request.action === 'showLoadingOverlay') {
      showLoadingOverlay(request.message || 'Memproses dengan AI...');
      sendResponse({ status: 'loading_shown' });
      return true;
    }

    if (request.action === 'hideLoadingOverlay') {
      hideLoadingOverlay();
      sendResponse({ status: 'loading_hidden' });
      return true;
    }

    if (request.action === 'showAnswerOverlay') {
      hideLoadingOverlay();
      showAnswerOverlay(request.answer, request.title || 'Jawaban AI');
      sendResponse({ status: 'answer_shown' });
      return true;
    }

    if (request.action === 'showErrorOverlay') {
      hideLoadingOverlay();
      showErrorOverlay(request.message, request.title || 'Error');
      sendResponse({ status: 'error_shown' });
      return true;
    }

    if (request.action === 'toggleFloatingMenu') {
      toggleFloatingMenu();
      sendResponse({ status: 'menu_toggled' });
      return true;
    }

    if (request.action === 'updateShortcuts') {
      shortcuts = { ...shortcuts, ...request.shortcuts };
      sendResponse({ status: 'shortcuts_updated' });
      return true;
    }

    if (request.action === 'toggleSecurityBypass') {
      if (request.enabled) {
        enableSecurityBypass();
      } else {
        disableSecurityBypass();
      }
      sendResponse({ status: 'bypass_toggled', enabled: securityBypassEnabled });
      return true;
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Check for Ctrl+Shift+Key combinations
    if (e.ctrlKey && e.shiftKey) {
      if (e.code === shortcuts.scanFull) {
        e.preventDefault();
        triggerFullScan();
      } else if (e.code === shortcuts.snipping) {
        e.preventDefault();
        startSnippingMode();
      } else if (e.code === shortcuts.toggleMenu) {
        e.preventDefault();
        toggleFloatingMenu();
      }
    }

    // ESC to cancel snipping
    if (e.key === 'Escape' && isSnipping) {
      cancelSnipping();
    }
  });

  function createFloatingMenu() {
    if (floatingMenu) return;

    floatingMenu = document.createElement('div');
    floatingMenu.className = 'soal-floating-menu minimized';
    
    // Toggle button (minimized state)
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'soal-menu-toggle';
    toggleBtn.innerHTML = '🤖';
    toggleBtn.onclick = expandMenu;

    // Menu content (expanded state)
    const menuContent = document.createElement('div');
    menuContent.className = 'soal-menu-content';
    
    menuContent.innerHTML = `
      <div class="soal-menu-header">
        <h3 class="soal-menu-title">🤖 Scan AI</h3>
        <button class="soal-menu-close">×</button>
      </div>
      <div class="soal-menu-status" id="soal-menu-status">
        <div class="soal-status-indicator" id="soal-status-indicator">⏳</div>
        <span id="soal-status-text">Checking API Keys...</span>
      </div>
      <div class="soal-menu-buttons" id="soal-menu-buttons">
        <button class="soal-menu-btn" data-action="snipping" disabled>
          📐 Pilih Area
          <span class="soal-menu-shortcut">Ctrl+Shift+A</span>
        </button>
        <button class="soal-menu-btn" data-action="fullscan" disabled>
          📸 Scan Halaman
          <span class="soal-menu-shortcut">Ctrl+Shift+S</span>
        </button>
        <button class="soal-menu-btn" data-action="settings">
          ⚙️ Settings
        </button>
      </div>
    `;

    floatingMenu.appendChild(toggleBtn);
    floatingMenu.appendChild(menuContent);
    document.body.appendChild(floatingMenu);

    // Event listeners
    menuContent.querySelector('.soal-menu-close').onclick = minimizeMenu;
    
    menuContent.querySelectorAll('.soal-menu-btn').forEach(btn => {
      btn.onclick = function() {
        const action = this.dataset.action;
        handleMenuAction(action);
      };
    });

    // Make draggable
    makeFloatingMenuDraggable();
  }

  function expandMenu() {
    if (!floatingMenu) return;
    floatingMenu.classList.remove('minimized');
    floatingMenu.classList.add('expanded');
  }

  function minimizeMenu() {
    if (!floatingMenu) return;
    floatingMenu.classList.remove('expanded');
    floatingMenu.classList.add('minimized');
  }

  function toggleFloatingMenu() {
    if (!floatingMenu) {
      createFloatingMenu();
      return;
    }

    if (floatingMenu.style.display === 'none') {
      floatingMenu.style.display = 'block';
    } else {
      floatingMenu.style.display = 'none';
    }
  }

  function handleMenuAction(action) {
    switch(action) {
      case 'snipping':
        startSnippingMode();
        minimizeMenu();
        break;
      case 'fullscan':
        triggerFullScan();
        minimizeMenu();
        break;
      case 'settings':
        safeSendMessage({ action: 'openSettings' });
        break;
    }
  }

  function makeFloatingMenuDraggable() {
    if (!floatingMenu) return;

    floatingMenu.addEventListener('mousedown', function(e) {
      if (e.target.closest('.soal-menu-btn') || e.target.closest('.soal-menu-close')) {
        return; // Don't drag when clicking buttons
      }

      isDragging = true;
      floatingMenu.classList.add('dragging');
      
      const rect = floatingMenu.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging || !floatingMenu) return;
      
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      
      // Keep within viewport
      const maxX = window.innerWidth - floatingMenu.offsetWidth;
      const maxY = window.innerHeight - floatingMenu.offsetHeight;
      
      floatingMenu.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      floatingMenu.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
      floatingMenu.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
      if (isDragging && floatingMenu) {
        isDragging = false;
        floatingMenu.classList.remove('dragging');
      }
    });
  }

  // Safe message sending dengan error handling
  function safeSendMessage(message, callback = null) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Runtime error:', chrome.runtime.lastError.message);
          
          if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
            handleExtensionContextInvalidated();
            return;
          }
        }
        
        if (callback) callback(response);
      });
    } catch (error) {
      console.log('Error sending message:', error);
      
      if (error.message.includes('Extension context invalidated')) {
        handleExtensionContextInvalidated();
      }
    }
  }

  function handleExtensionContextInvalidated() {
    console.log('🔄 Extension context invalidated - showing reload message');
    
    // Show user-friendly message
    const reloadOverlay = document.createElement('div');
    reloadOverlay.className = 'soal-answer-overlay';
    reloadOverlay.id = 'soal-reload-overlay';
    
    reloadOverlay.innerHTML = `
      <div class="soal-answer-header" style="background: linear-gradient(135deg, #ff6b35, #f7931e) !important;">
        <h3>🔄 Extension Updated</h3>
        <button class="soal-answer-close" onclick="this.closest('.soal-answer-overlay').remove()">×</button>
      </div>
      <div class="soal-answer-content">
        <div class="soal-answer-text">
          Extension telah di-update atau di-reload.<br><br>
          <strong>Refresh halaman ini</strong> untuk menggunakan fitur scan terbaru.
        </div>
        <div class="soal-answer-actions">
          <button class="soal-answer-btn soal-answer-btn-primary" onclick="window.location.reload()">
            🔄 Refresh Halaman
          </button>
          <button class="soal-answer-btn soal-answer-btn-secondary" onclick="this.closest('.soal-answer-overlay').remove()">
            Tutup
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(reloadOverlay);
    
    // Auto-remove existing overlays dan disable floating menu
    if (floatingMenu) {
      floatingMenu.style.opacity = '0.5';
      floatingMenu.style.pointerEvents = 'none';
    }
  }

  function triggerFullScan() {
    console.log('Triggering full scan...');
    safeSendMessage({ action: 'captureScreenshot' });
  }

  function startSnippingMode() {
    console.log('Starting snipping mode');
    if (isSnipping) return;
    
    isSnipping = true;
    
    // Hide floating menu temporarily
    if (floatingMenu) {
      floatingMenu.style.display = 'none';
    }
    
    // Create overlay
    overlay = document.createElement('div');
    overlay.className = 'soal-scanner-overlay';
    
    // Instructions
    const instructions = document.createElement('div');
    instructions.className = 'soal-scanner-instructions';
    instructions.textContent = 'Drag untuk pilih area soal, lalu lepas untuk scan';
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'soal-scanner-cancel-btn';
    cancelBtn.textContent = 'Cancel (ESC)';
    cancelBtn.onclick = cancelSnipping;
    
    // Selection box
    selectionBox = document.createElement('div');
    selectionBox.className = 'soal-scanner-selection';
    selectionBox.style.display = 'none';
    
    overlay.appendChild(instructions);
    overlay.appendChild(cancelBtn);
    overlay.appendChild(selectionBox);
    document.body.appendChild(overlay);
    
    // Event listeners
    overlay.addEventListener('mousedown', startSelection);
    overlay.addEventListener('mousemove', updateSelection);
    overlay.addEventListener('mouseup', endSelection);
  }

  function startSelection(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  }

  function updateSelection(e) {
    if (!selectionBox || selectionBox.style.display === 'none') return;
    
    e.preventDefault();
    endX = e.clientX;
    endY = e.clientY;
    
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  function endSelection(e) {
    if (!selectionBox || selectionBox.style.display === 'none') return;
    
    e.preventDefault();
    const rect = selectionBox.getBoundingClientRect();
    
    // Check minimum size
    if (rect.width < 50 || rect.height < 50) {
      cancelSnipping();
      return;
    }
    
    // Send selection to background
    const selection = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
    
    safeSendMessage({ 
      action: 'captureSelectedArea', 
      selection: selection 
    });
    
    cancelSnipping();
  }

  function cancelSnipping() {
    console.log('Cancelling snipping');
    if (!isSnipping) return;
    
    isSnipping = false;
    
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    overlay = null;
    selectionBox = null;
    
    // Show floating menu again
    if (floatingMenu) {
      floatingMenu.style.display = 'block';
    }
  }

  function showLoadingOverlay(message) {
    hideLoadingOverlay();
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'soal-loading-overlay';
    loadingOverlay.id = 'soal-loading-overlay';
    
    loadingOverlay.innerHTML = `
      <div class="soal-loading-content">
        <div class="soal-loading-spinner"></div>
        <p class="soal-loading-text">${message}</p>
      </div>
    `;
    
    document.body.appendChild(loadingOverlay);
  }

  function hideLoadingOverlay() {
    const existing = document.getElementById('soal-loading-overlay');
    if (existing) {
      existing.remove();
    }
  }

  function showAnswerOverlay(answer, title) {
    hideAnswerOverlay();
    
    const answerOverlay = document.createElement('div');
    answerOverlay.className = 'soal-answer-overlay';
    answerOverlay.id = 'soal-answer-overlay';
    
    // Escape quotes for onclick
    const escapedAnswer = answer.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    answerOverlay.innerHTML = `
      <div class="soal-answer-header">
        <h3>🤖 ${title}</h3>
        <button class="soal-answer-close" onclick="this.closest('.soal-answer-overlay').remove()">×</button>
      </div>
      <div class="soal-answer-content">
        <div class="soal-answer-text">${answer}</div>
        <div class="soal-answer-actions">
          <button class="soal-answer-btn soal-answer-btn-primary" onclick="navigator.clipboard.writeText('${escapedAnswer}').then(() => { this.textContent = '✓ Disalin!'; setTimeout(() => this.textContent = 'Copy Jawaban', 2000); })">Copy Jawaban</button>
          <button class="soal-answer-btn soal-answer-btn-secondary" onclick="this.closest('.soal-answer-overlay').remove()">Tutup</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(answerOverlay);
    
    // Auto close setelah 30 detik
    setTimeout(() => {
      const overlay = document.getElementById('soal-answer-overlay');
      if (overlay) overlay.remove();
    }, 30000);
  }

  function showErrorOverlay(message, title) {
    hideAnswerOverlay();
    
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'soal-answer-overlay';
    errorOverlay.id = 'soal-error-overlay';
    
    errorOverlay.innerHTML = `
      <div class="soal-answer-header" style="background: linear-gradient(135deg, #dc3545, #c82333) !important;">
        <h3>❌ ${title}</h3>
        <button class="soal-answer-close" onclick="this.closest('.soal-answer-overlay').remove()">×</button>
      </div>
      <div class="soal-answer-content">
        <div class="soal-answer-text">${message}</div>
        <div class="soal-answer-actions">
          <button class="soal-answer-btn soal-answer-btn-secondary" onclick="this.closest('.soal-answer-overlay').remove()">Tutup</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(errorOverlay);
    
    // Auto close setelah 10 detik
    setTimeout(() => {
      const overlay = document.getElementById('soal-error-overlay');
      if (overlay) overlay.remove();
    }, 10000);
  }

  function hideAnswerOverlay() {
    const existing = document.getElementById('soal-answer-overlay');
    if (existing) existing.remove();
    
    const existingError = document.getElementById('soal-error-overlay');
    if (existingError) existingError.remove();
  }

  function updateFloatingMenuStatus() {
    if (!floatingMenu) return;

    const statusIndicator = floatingMenu.querySelector('#soal-status-indicator');
    const statusText = floatingMenu.querySelector('#soal-status-text');
    const scanButtons = floatingMenu.querySelectorAll('.soal-menu-btn[data-action="snipping"], .soal-menu-btn[data-action="fullscan"]');
    const toggleBtn = floatingMenu.querySelector('.soal-menu-toggle');

    if (apiKeysReady && apiKeyCount > 0) {
      // API Keys ready
      statusIndicator.textContent = '🟢';
      statusText.textContent = `Ready! ${apiKeyCount} API key${apiKeyCount > 1 ? 's' : ''}`;
      
      // Enable scan buttons
      scanButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
      });
      
      // Update toggle button to show ready status
      toggleBtn.innerHTML = '🤖✅';
      
    } else {
      // No API Keys
      statusIndicator.textContent = '🔴';
      statusText.textContent = 'No API Keys - Click Settings';
      
      // Disable scan buttons
      scanButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      });
      
      // Update toggle button to show error status
      toggleBtn.innerHTML = '🤖❌';
    }
  }

  function showError(message) {
    // Show error overlay
    showErrorOverlay(message, 'Scan Error');
    
    // Also show console error
    console.error('Soal Scanner Error:', message);
  }

  // Initial check untuk API keys saat page load
  chrome.storage.sync.get(['geminiApiKeys'], function(result) {
    const storedKeys = result.geminiApiKeys || [];
    apiKeysReady = storedKeys.length > 0;
    apiKeyCount = storedKeys.length;
    
    console.log(`🔄 Initial API key check: ${apiKeyCount} keys found, ready: ${apiKeysReady}`);
    
    // Update UI saat content script pertama kali load
    updateFloatingMenuStatus();
    
    // Request latest status dari background script
    safeSendMessage({ action: 'ping' })
      .then(response => {
        console.log('✅ Content script connected to background');
        // Request untuk update status API keys
        safeSendMessage({ action: 'requestApiKeyStatus' });
      })
      .catch(error => {
        console.log('⚠️ Background script not ready yet, will retry');
      });
  });

  console.log('Soal Scanner AI content script loaded');
})(); 