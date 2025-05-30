/**
 * Soal Scanner AI - Popup Script
 * Extension popup dengan status indicators dan scan controls
 * 
 * @author Dany Pratmanto
 * @contact WhatsApp: 08974041777
 * @version 2.0.0
 * @description Multi API key aware popup dengan real-time updates
 */

document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scanButton');
  const snippingButton = document.getElementById('snippingButton');
  const settingsButton = document.getElementById('settingsButton');
  const statusDiv = document.getElementById('status');

  // Cek API key saat popup dibuka
  tampilkanStatusApiKey();

  // Listen untuk storage changes (API keys updated)
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync' && changes.geminiApiKeys) {
      console.log('API Keys changed in popup, refreshing status...');
      tampilkanStatusApiKey();
    }
  });

  // Refresh status ketika popup window di-focus (user balik dari options)
  window.addEventListener('focus', function() {
    console.log('Popup focused, refreshing API key status...');
    tampilkanStatusApiKey();
  });

  // Event listener untuk tombol snipping
  snippingButton.addEventListener('click', function() {
    console.log('Snipping button clicked');
    statusDiv.textContent = 'Mempersiapkan snipping tool...';
    snippingButton.disabled = true;
    scanButton.disabled = true;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tabId = tabs[0].id;
      const tabUrl = tabs[0].url;
      
      console.log('Current tab:', tabId, tabUrl);
      
      // Check jika URL bisa di-inject
      if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
        tampilkanError('Snipping tool tidak bisa digunakan di halaman ini. Gunakan scan halaman penuh.');
        enableButtons();
        return;
      }
      
      // Test apakah content script sudah ada
      chrome.tabs.sendMessage(tabId, {action: 'ping'}, function(response) {
        if (chrome.runtime.lastError || !response) {
          console.log('Content script not found, injecting...');
          // Inject content script jika belum ada
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: initSnippingTool
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.error('Error inject script:', chrome.runtime.lastError);
              tampilkanError('Error inject script: ' + chrome.runtime.lastError.message);
              enableButtons();
              return;
            }
            
            console.log('Script injected successfully');
            // Inject CSS juga
            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: getSnippingCSS()
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error inject CSS:', chrome.runtime.lastError);
                tampilkanError('Error inject CSS: ' + chrome.runtime.lastError.message);
                enableButtons();
                return;
              }
              
              console.log('CSS injected successfully');
              startSnippingOnPage(tabId);
            });
          });
        } else {
          console.log('Content script already exists');
          startSnippingOnPage(tabId);
        }
      });
    });
  });

  function startSnippingOnPage(tabId) {
    // Tunggu sebentar untuk memastikan script loaded
    setTimeout(() => {
      console.log('Starting snipping on tab:', tabId);
      // Sekarang kirim message untuk start snipping
      chrome.tabs.sendMessage(tabId, {action: 'startSnipping'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending startSnipping:', chrome.runtime.lastError);
          tampilkanError('Error: ' + chrome.runtime.lastError.message);
          enableButtons();
          return;
        }
        
        console.log('Snipping started response:', response);
        if (response && response.status === 'snipping_started') {
          statusDiv.textContent = 'Drag area soal, lalu lepas untuk scan...';
        }
      });
    }, 200);
  }

  function getSnippingCSS() {
    return `
      .soal-scanner-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.3) !important;
        z-index: 999999 !important;
        cursor: crosshair !important;
        user-select: none !important;
      }
      
      .soal-scanner-selection {
        position: absolute !important;
        border: 2px dashed #007bff !important;
        background: rgba(0, 123, 255, 0.1) !important;
        pointer-events: none !important;
      }
      
      .soal-scanner-instructions {
        position: fixed !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: #007bff !important;
        color: white !important;
        padding: 10px 20px !important;
        border-radius: 20px !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        z-index: 1000000 !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
      }
      
      .soal-scanner-cancel-btn {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: #dc3545 !important;
        color: white !important;
        border: none !important;
        padding: 10px 15px !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        font-family: Arial, sans-serif !important;
        font-size: 12px !important;
        z-index: 1000000 !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
      }
      
      .soal-scanner-cancel-btn:hover {
        background: #c82333 !important;
      }

      /* Overlay untuk jawaban AI */
      .soal-answer-overlay {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        z-index: 1000001 !important;
        max-width: 500px !important;
        max-height: 70vh !important;
        overflow-y: auto !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        animation: fadeInScale 0.3s ease-out !important;
      }

      @keyframes fadeInScale {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .soal-answer-header {
        background: linear-gradient(135deg, #28a745, #20c997) !important;
        color: white !important;
        padding: 15px 20px !important;
        border-radius: 12px 12px 0 0 !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }

      .soal-answer-header h3 {
        margin: 0 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
      }

      .soal-answer-close {
        background: none !important;
        border: none !important;
        color: white !important;
        font-size: 24px !important;
        cursor: pointer !important;
        padding: 0 !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: background 0.2s !important;
      }

      .soal-answer-close:hover {
        background: rgba(255,255,255,0.2) !important;
      }

      .soal-answer-content {
        padding: 20px !important;
        line-height: 1.6 !important;
        color: #333 !important;
      }

      .soal-answer-text {
        font-size: 16px !important;
        margin-bottom: 15px !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
      }

      .soal-answer-actions {
        display: flex !important;
        gap: 10px !important;
        padding-top: 15px !important;
        border-top: 1px solid #eee !important;
      }

      .soal-answer-btn {
        padding: 8px 16px !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 14px !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        font-weight: 500 !important;
      }

      .soal-answer-btn-primary {
        background: #007bff !important;
        color: white !important;
      }

      .soal-answer-btn-primary:hover {
        background: #0056b3 !important;
      }

      .soal-answer-btn-secondary {
        background: #6c757d !important;
        color: white !important;
      }

      .soal-answer-btn-secondary:hover {
        background: #545b62 !important;
      }

      /* Loading overlay */
      .soal-loading-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.5) !important;
        z-index: 1000000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: Arial, sans-serif !important;
      }

      .soal-loading-content {
        background: white !important;
        padding: 30px !important;
        border-radius: 12px !important;
        text-align: center !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
      }

      .soal-loading-spinner {
        width: 40px !important;
        height: 40px !important;
        border: 4px solid #f3f3f3 !important;
        border-top: 4px solid #007bff !important;
        border-radius: 50% !important;
        animation: spin 1s linear infinite !important;
        margin: 0 auto 15px !important;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .soal-loading-text {
        color: #333 !important;
        font-size: 16px !important;
        margin: 0 !important;
      }
    `;
  }

  function initSnippingTool() {
    // Prevent multiple injection
    if (window.soalScannerContentLoaded) {
      return;
    }
    window.soalScannerContentLoaded = true;

    let isSelecting = false;
    let selectionBox = null;
    let overlay = null;
    let startX, startY, endX, endY;

    // Listen untuk pesan dari popup dan background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Content script received message:', request);
      
      if (request.action === 'ping') {
        sendResponse({ status: 'pong' });
        return;
      }
      
      if (request.action === 'startSnipping') {
        startSnippingMode();
        sendResponse({ status: 'snipping_started' });
        return;
      }

      if (request.action === 'showLoadingOverlay') {
        showLoadingOverlay(request.message || 'Memproses dengan AI...');
        sendResponse({ status: 'loading_shown' });
        return;
      }

      if (request.action === 'hideLoadingOverlay') {
        hideLoadingOverlay();
        sendResponse({ status: 'loading_hidden' });
        return;
      }

      if (request.action === 'showAnswerOverlay') {
        hideLoadingOverlay(); // Hide loading dulu
        showAnswerOverlay(request.answer, request.title || 'Jawaban AI');
        sendResponse({ status: 'answer_shown' });
        return;
      }

      if (request.action === 'showErrorOverlay') {
        hideLoadingOverlay(); // Hide loading dulu
        showErrorOverlay(request.message, request.title || 'Error');
        sendResponse({ status: 'error_shown' });
        return;
      }
    });

    function showLoadingOverlay(message) {
      // Remove existing loading overlay
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
      // Remove existing answer overlay
      hideAnswerOverlay();
      
      const answerOverlay = document.createElement('div');
      answerOverlay.className = 'soal-answer-overlay';
      answerOverlay.id = 'soal-answer-overlay';
      
      answerOverlay.innerHTML = `
        <div class="soal-answer-header">
          <h3>🤖 ${title}</h3>
          <button class="soal-answer-close" onclick="this.closest('.soal-answer-overlay').remove()">×</button>
        </div>
        <div class="soal-answer-content">
          <div class="soal-answer-text">${answer}</div>
          <div class="soal-answer-actions">
            <button class="soal-answer-btn soal-answer-btn-primary" onclick="navigator.clipboard.writeText('${answer.replace(/'/g, "\\'")}').then(() => { this.textContent = '✓ Disalin!'; setTimeout(() => this.textContent = 'Copy Jawaban', 2000); })">Copy Jawaban</button>
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
      // Remove existing overlays
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
      
      // Auto close setelah 10 detik untuk error
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

    function startSnippingMode() {
      console.log('Starting snipping mode');
      if (isSelecting) return;
      
      isSelecting = true;
      
      // Buat overlay
      overlay = document.createElement('div');
      overlay.className = 'soal-scanner-overlay';
      
      // Buat instructions
      const instructions = document.createElement('div');
      instructions.className = 'soal-scanner-instructions';
      instructions.textContent = 'Drag untuk pilih area soal, lalu lepas untuk scan';
      
      // Buat cancel button
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'soal-scanner-cancel-btn';
      cancelBtn.textContent = 'Cancel (ESC)';
      cancelBtn.onclick = cancelSnipping;
      
      // Selection box
      selectionBox = document.createElement('div');
      selectionBox.className = 'soal-scanner-selection';
      selectionBox.style.display = 'none';
      
      // Append elements
      overlay.appendChild(instructions);
      overlay.appendChild(cancelBtn);
      overlay.appendChild(selectionBox);
      document.body.appendChild(overlay);
      
      // Event listeners
      overlay.addEventListener('mousedown', startSelection);
      overlay.addEventListener('mousemove', updateSelection);
      overlay.addEventListener('mouseup', endSelection);
      document.addEventListener('keydown', handleKeyPress);
    }

    function startSelection(e) {
      e.preventDefault();
      console.log('Starting selection');
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
      console.log('Ending selection');
      const rect = selectionBox.getBoundingClientRect();
      
      // Jika area terlalu kecil, cancel
      if (rect.width < 50 || rect.height < 50) {
        console.log('Selection too small, cancelling');
        cancelSnipping();
        return;
      }
      
      // Kirim koordinat ke background untuk crop screenshot
      const selection = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
      
      console.log('Sending selection:', selection);
      try {
        chrome.runtime.sendMessage({ 
          action: 'captureSelectedArea', 
          selection: selection 
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }
      
      cancelSnipping();
    }

    function handleKeyPress(e) {
      if (e.key === 'Escape') {
        cancelSnipping();
      }
    }

    function cancelSnipping() {
      console.log('Cancelling snipping');
      if (!isSelecting) return;
      
      isSelecting = false;
      
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      
      overlay = null;
      selectionBox = null;
      
      document.removeEventListener('keydown', handleKeyPress);
      
      // Kirim cancel message ke background
      try {
        chrome.runtime.sendMessage({ action: 'snippingCancelled' });
      } catch (error) {
        console.error('Error sending cancel message:', error);
      }
    }

    console.log('Snipping tool initialized');
  }

  // Event listener untuk tombol scan biasa
  scanButton.addEventListener('click', function() {
    statusDiv.textContent = 'Mempersiapkan scan halaman...';
    scanButton.disabled = true;
    snippingButton.disabled = true;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const tabId = tabs[0].id;
      const tabUrl = tabs[0].url;
      
      console.log('Current tab for full scan:', tabId, tabUrl);
      
      // Check jika URL bisa di-inject
      if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('about:')) {
        tampilkanError('Extension tidak bisa digunakan di halaman ini. Coba di halaman web normal.');
        enableButtons();
        return;
      }
      
      // Test apakah content script sudah ada
      chrome.tabs.sendMessage(tabId, {action: 'ping'}, function(response) {
        if (chrome.runtime.lastError || !response) {
          console.log('Content script not found for full scan, injecting...');
          // Inject content script jika belum ada
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: initSnippingTool
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.error('Error inject script for full scan:', chrome.runtime.lastError);
              tampilkanError('Error inject script: ' + chrome.runtime.lastError.message);
              enableButtons();
              return;
            }
            
            console.log('Script injected successfully for full scan');
            // Inject CSS juga
            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: getSnippingCSS()
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error inject CSS for full scan:', chrome.runtime.lastError);
                tampilkanError('Error inject CSS: ' + chrome.runtime.lastError.message);
                enableButtons();
                return;
              }
              
              console.log('CSS injected successfully for full scan');
              startFullScan();
            });
          });
        } else {
          console.log('Content script already exists for full scan');
          startFullScan();
        }
      });
    });
  });

  function startFullScan() {
    statusDiv.textContent = 'Mengambil screenshot halaman...';
    
    chrome.runtime.sendMessage({ action: 'captureScreenshot' }, function(response) {
      if (chrome.runtime.lastError) {
        tampilkanError('Error: ' + chrome.runtime.lastError.message);
        console.error(chrome.runtime.lastError.message);
        enableButtons();
        return;
      }
      
      if (response) {
        switch(response.status) {
          case 'no_api_key':
            tampilkanError('API Key belum diset. Klik Settings untuk mengatur API Key.');
            break;
          case 'processing':
            statusDiv.textContent = 'Memproses gambar dengan AI...';
            break;
          default:
            tampilkanError('Response tidak dikenal: ' + response.status);
        }
      }
    });
  }

  // Event listener untuk tombol settings
  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // Listen untuk update status dari background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updatePopupStatus') {
      
      switch(request.status) {
        case 'api_keys_updated':
          console.log(`API Keys updated notification received: ${request.keyCount} keys`);
          tampilkanStatusApiKey();
          break;
        case 'success':
          enableButtons();
          tampilkanSukses('Jawaban:', request.answer);
          break;
        case 'error':
          enableButtons();
          tampilkanError('Error: ' + request.message);
          break;
        default:
          enableButtons();
          statusDiv.textContent = request.message || 'Status tidak dikenal';
      }
    } else if (request.action === 'snippingCancelled') {
      statusDiv.textContent = 'Snipping dibatalkan';
      enableButtons();
    }
  });

  // Fungsi helper untuk enable buttons
  function enableButtons() {
    scanButton.disabled = false;
    snippingButton.disabled = false;
  }

  // Fungsi helper untuk tampilkan status API key
  function tampilkanStatusApiKey() {
    chrome.storage.sync.get(['geminiApiKeys', 'geminiApiKey'], function(result) {
      // Check new multi-key format first
      const apiKeys = result.geminiApiKeys || [];
      const legacyKey = result.geminiApiKey;
      
      // Handle legacy migration
      if (legacyKey && apiKeys.length === 0) {
        chrome.storage.sync.set({ 'geminiApiKeys': [legacyKey] });
        chrome.storage.sync.remove('geminiApiKey');
        tampilkanStatusSiap(1);
        return;
      }
      
      if (apiKeys.length > 0) {
        // Check if keys are not empty
        const validKeys = apiKeys.filter(key => key && key.trim() !== '');
        if (validKeys.length > 0) {
          tampilkanStatusSiap(validKeys.length);
        } else {
          tampilkanStatusPerluSetup();
        }
      } else {
        tampilkanStatusPerluSetup();
      }
    });
  }
  
  function tampilkanStatusSiap(keyCount) {
    statusDiv.innerHTML = `
      <div style="color: #28a745; font-weight: bold; margin-bottom: 5px;">
        ✅ Siap untuk scan soal
      </div>
      <div style="font-size: 12px; color: #6c757d;">
        ${keyCount} API key${keyCount > 1 ? 's' : ''} aktif dengan round-robin
      </div>
    `;
    enableButtons();
  }
  
  function tampilkanStatusPerluSetup() {
    statusDiv.innerHTML = `
      <div style="color: #ffc107; font-weight: bold; margin-bottom: 5px;">
        ⚠️ API Key belum diset
      </div>
      <div style="font-size: 12px; color: #6c757d;">
        Klik Settings untuk menambah API Key Gemini
      </div>
    `;
    scanButton.disabled = true;
    snippingButton.disabled = true;
  }

  // Fungsi helper untuk tampilkan error
  function tampilkanError(message) {
    statusDiv.innerHTML = `<div style="color: #dc3545; font-weight: bold; margin-bottom: 10px;">${message}</div>`;
    enableButtons();
  }

  // Fungsi helper untuk tampilkan sukses dengan answer
  function tampilkanSukses(title, answer) {
    // Format jawaban untuk tampilan yang lebih baik
    const formattedAnswer = answer.replace(/\n/g, '<br>');
    
    statusDiv.innerHTML = `
      <div style="color: #28a745; font-weight: bold; margin-bottom: 8px;">${title}</div>
      <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 13px; line-height: 1.4; max-height: 200px; overflow-y: auto; border-left: 3px solid #28a745;">
        ${formattedAnswer}
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
        💡 Tips: Gunakan snipping untuk area yang lebih spesifik
      </div>
    `;
    enableButtons();
  }
});