/**
 * Soal Scanner AI - Options Script
 * Settings page untuk API key management dan configuration
 * 
 * @author Dany Pratmanto
 * @contact WhatsApp: 08974041777
 * @version 2.0.0
 * @description Multi API key management dengan round-robin configuration
 */

document.addEventListener('DOMContentLoaded', function() {
  const overlayEnabledToggle = document.getElementById('overlayEnabled');
  const floatingMenuEnabledToggle = document.getElementById('floatingMenuEnabled');
  const saveShortcutsButton = document.getElementById('saveShortcutsButton');
  const addApiKeyButton = document.getElementById('addApiKeyButton');
  const saveApiKeysButton = document.getElementById('saveApiKeysButton');
  const testAllKeysButton = document.getElementById('testAllKeysButton');
  const apiKeysContainer = document.getElementById('apiKeysContainer');
  const roundRobinInfo = document.getElementById('roundRobinInfo');
  const statusDiv = document.getElementById('status');

  // Shortcut selectors
  const shortcutScanFull = document.getElementById('shortcutScanFull');
  const shortcutSnipping = document.getElementById('shortcutSnipping');
  const shortcutToggleMenu = document.getElementById('shortcutToggleMenu');

  // Current shortcut displays
  const currentScanShortcut = document.getElementById('currentScanShortcut');
  const currentSnippingShortcut = document.getElementById('currentSnippingShortcut');
  const currentToggleShortcut = document.getElementById('currentToggleShortcut');

  let apiKeys = [];
  let currentKeyIndex = 0;

  // Load semua settings yang sudah tersimpan
  chrome.storage.sync.get([
    'geminiApiKeys',
    'currentKeyIndex', 
    'overlayEnabled', 
    'floatingMenuEnabled',
    'customShortcuts',
    // Legacy support
    'geminiApiKey'
  ], function(result) {
    // Handle legacy single API key
    if (result.geminiApiKey && !result.geminiApiKeys) {
      apiKeys = [result.geminiApiKey];
      // Migrate to new format
      chrome.storage.sync.set({ 'geminiApiKeys': apiKeys });
      chrome.storage.sync.remove('geminiApiKey');
    } else {
      apiKeys = result.geminiApiKeys || [];
    }
    
    currentKeyIndex = result.currentKeyIndex || 0;
    
    // Overlay toggle (default true)
    overlayEnabledToggle.checked = result.overlayEnabled !== false;
    
    // Floating menu toggle (default true)
    floatingMenuEnabledToggle.checked = result.floatingMenuEnabled !== false;

    // Custom shortcuts
    const shortcuts = result.customShortcuts || {
      scanFull: 'KeyS',
      snipping: 'KeyA',
      toggleMenu: 'KeyF'
    };

    shortcutScanFull.value = shortcuts.scanFull;
    shortcutSnipping.value = shortcuts.snipping;
    shortcutToggleMenu.value = shortcuts.toggleMenu;

    updateShortcutDisplay(shortcuts);
    renderApiKeys();
    updateRoundRobinInfo();

    if (apiKeys.length === 0) {
      tampilkanStatus('Belum ada API Key. Tambahkan minimal 1 API Key untuk menggunakan extension.', 'info');
    } else {
      tampilkanStatus(`${apiKeys.length} API Key loaded. Ready untuk round-robin!`, 'success');
    }
  });

  // Event listeners untuk toggles
  overlayEnabledToggle.addEventListener('change', function() {
    const isEnabled = overlayEnabledToggle.checked;
    
    chrome.storage.sync.set({ 'overlayEnabled': isEnabled }, function() {
      if (chrome.runtime.lastError) {
        tampilkanStatus('Gagal menyimpan setting overlay: ' + chrome.runtime.lastError.message, 'error');
      } else {
        tampilkanStatus(`Overlay ${isEnabled ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
      }
    });
  });

  floatingMenuEnabledToggle.addEventListener('change', function() {
    const isEnabled = floatingMenuEnabledToggle.checked;
    
    chrome.storage.sync.set({ 'floatingMenuEnabled': isEnabled }, function() {
      if (chrome.runtime.lastError) {
        tampilkanStatus('Gagal menyimpan setting floating menu: ' + chrome.runtime.lastError.message, 'error');
      } else {
        tampilkanStatus(`Floating menu ${isEnabled ? 'diaktifkan' : 'dinonaktifkan'}. Refresh halaman untuk melihat perubahan.`, 'success');
        
        // Notify all tabs tentang perubahan setting
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'toggleFloatingMenu'
              }).catch(() => {}); // Ignore errors untuk tabs yang tidak support
            }
          });
        });
      }
    });
  });

  // Event listener untuk add API key
  addApiKeyButton.addEventListener('click', function() {
    if (apiKeys.length >= 5) {
      tampilkanStatus('Maksimal 5 API Keys. Hapus key yang tidak diperlukan terlebih dahulu.', 'warning');
      return;
    }
    
    addNewApiKey();
  });

  // Event listener untuk save API keys
  saveApiKeysButton.addEventListener('click', function() {
    // Validasi apakah ada API key yang tidak kosong
    const nonEmptyKeys = apiKeys.filter(key => key.trim() !== '');
    
    if (nonEmptyKeys.length === 0) {
      tampilkanStatus('Tidak ada API Key untuk disimpan. Tambahkan minimal 1 API Key terlebih dahulu.', 'warning');
      return;
    }
    
    // Update array dengan non-empty keys only
    apiKeys = nonEmptyKeys;
    
    // Save with explicit notification
    saveApiKeysWithNotification();
  });

  // Event listener untuk test all keys
  testAllKeysButton.addEventListener('click', function() {
    testAllApiKeys();
  });

  // Auto-save shortcuts when changed
  [shortcutScanFull, shortcutSnipping, shortcutToggleMenu].forEach(select => {
    select.addEventListener('change', function() {
      // Check for conflicts
      const values = [shortcutScanFull.value, shortcutSnipping.value, shortcutToggleMenu.value];
      const duplicates = values.filter((item, index) => values.indexOf(item) !== index);
      
      if (duplicates.length > 0) {
        tampilkanStatus('Error: Tidak boleh ada shortcut yang sama!', 'error');
        return;
      }
      
      saveCustomShortcuts();
    });
  });

  function renderApiKeys() {
    apiKeysContainer.innerHTML = '';
    
    if (apiKeys.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666; border: 2px dashed #ddd; border-radius: 8px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
          <div style="font-weight: 600; margin-bottom: 5px;">Belum ada API Key</div>
          <div style="font-size: 14px;">Klik "Tambah API Key" untuk memulai</div>
        </div>
      `;
      apiKeysContainer.appendChild(emptyState);
      return;
    }

    apiKeys.forEach((key, index) => {
      const keyItem = document.createElement('div');
      keyItem.className = 'api-key-item';
      keyItem.innerHTML = `
        <div class="round-robin-indicator ${index === currentKeyIndex ? 'active' : 'inactive'}"></div>
        <div style="font-weight: 600; font-size: 12px; color: #666; min-width: 40px;">
          Key ${index + 1}:
        </div>
        <input 
          type="text" 
          class="api-key-input" 
          value="${key}" 
          placeholder="AIzaSy..."
          data-index="${index}"
        >
        <div class="api-key-status unknown">Unknown</div>
        <div class="api-key-actions">
          <button class="api-key-btn test" data-index="${index}">Test</button>
          <button class="api-key-btn remove" data-index="${index}" ${apiKeys.length === 1 ? 'disabled' : ''}>Remove</button>
        </div>
      `;
      
      // Event listeners
      const input = keyItem.querySelector('.api-key-input');
      const testBtn = keyItem.querySelector('.api-key-btn.test');
      const removeBtn = keyItem.querySelector('.api-key-btn.remove');
      
      input.addEventListener('input', function() {
        apiKeys[index] = this.value.trim();
        // Don't auto-save, wait for explicit save button
        // Reset status when changed
        const statusEl = keyItem.querySelector('.api-key-status');
        statusEl.textContent = 'Modified';
        statusEl.className = 'api-key-status unknown';
        keyItem.className = 'api-key-item';
        
        // Show save button indicator
        tampilkanStatus('API Keys dimodifikasi. Klik "Simpan API Keys" untuk menyimpan perubahan.', 'info');
      });
      
      testBtn.addEventListener('click', function() {
        testSingleApiKey(index);
      });
      
      removeBtn.addEventListener('click', function() {
        removeApiKey(index);
      });
      
      apiKeysContainer.appendChild(keyItem);
    });
  }

  function addNewApiKey() {
    apiKeys.push('');
    renderApiKeys();
    tampilkanStatus('API Key baru ditambahkan. Klik "Simpan API Keys" setelah mengisi key.', 'info');
    
    // Focus pada input yang baru ditambahkan
    setTimeout(() => {
      const inputs = apiKeysContainer.querySelectorAll('.api-key-input');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) lastInput.focus();
    }, 100);
  }

  function removeApiKey(index) {
    if (apiKeys.length <= 1) {
      tampilkanStatus('Minimal 1 API Key harus ada!', 'warning');
      return;
    }
    
    apiKeys.splice(index, 1);
    
    // Adjust current key index if needed
    if (currentKeyIndex >= apiKeys.length) {
      currentKeyIndex = 0;
    }
    
    saveApiKeys();
    renderApiKeys();
    updateRoundRobinInfo();
    tampilkanStatus(`API Key ${index + 1} berhasil dihapus`, 'success');
  }

  async function testSingleApiKey(index) {
    if (!apiKeys[index] || apiKeys[index].trim() === '') {
      tampilkanStatus('API Key tidak boleh kosong!', 'error');
      return;
    }
    
    const keyItem = apiKeysContainer.children[index];
    const statusEl = keyItem.querySelector('.api-key-status');
    const testBtn = keyItem.querySelector('.api-key-btn.test');
    
    // Set testing state
    keyItem.className = 'api-key-item testing';
    statusEl.textContent = 'Testing...';
    statusEl.className = 'api-key-status testing';
    testBtn.disabled = true;
    
    try {
      const isValid = await testApiKey(apiKeys[index]);
      
      if (isValid) {
        keyItem.className = 'api-key-item valid';
        statusEl.textContent = 'Valid';
        statusEl.className = 'api-key-status valid';
      } else {
        keyItem.className = 'api-key-item invalid';
        statusEl.textContent = 'Invalid';
        statusEl.className = 'api-key-status invalid';
      }
    } catch (error) {
      keyItem.className = 'api-key-item invalid';
      statusEl.textContent = 'Error';
      statusEl.className = 'api-key-status invalid';
    } finally {
      testBtn.disabled = false;
    }
  }

  async function testAllApiKeys() {
    if (apiKeys.length === 0) {
      tampilkanStatus('Tidak ada API Key untuk ditest!', 'warning');
      return;
    }
    
    tampilkanStatus('Testing semua API Keys...', 'info');
    testAllKeysButton.disabled = true;
    
    let validCount = 0;
    const testPromises = apiKeys.map((key, index) => {
      if (key.trim() === '') return Promise.resolve(false);
      return testSingleApiKey(index);
    });
    
    try {
      await Promise.all(testPromises);
      
      // Count valid keys
      const keyItems = apiKeysContainer.querySelectorAll('.api-key-item');
      keyItems.forEach(item => {
        const status = item.querySelector('.api-key-status');
        if (status.textContent === 'Valid') {
          validCount++;
        }
      });
      
      if (validCount > 0) {
        tampilkanStatus(`✅ ${validCount}/${apiKeys.length} API Keys valid! Round-robin siap digunakan.`, 'success');
      } else {
        tampilkanStatus(`❌ Semua API Keys invalid. Periksa kembali keys Anda.`, 'error');
      }
    } catch (error) {
      tampilkanStatus('Error saat testing API Keys: ' + error.message, 'error');
    } finally {
      testAllKeysButton.disabled = false;
    }
  }

  async function testApiKey(apiKey) {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const testPayload = {
        contents: [{
          parts: [{ text: "Test API connection" }]
        }]
      };

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
    }
  }

  function saveApiKeys() {
    chrome.storage.sync.set({ 
      'geminiApiKeys': apiKeys,
      'currentKeyIndex': currentKeyIndex 
    }, function() {
      if (chrome.runtime.lastError) {
        tampilkanStatus('Gagal menyimpan API Keys: ' + chrome.runtime.lastError.message, 'error');
      } else {
        updateRoundRobinInfo();
        
        // Notify background script that API keys are updated
        chrome.runtime.sendMessage({ 
          action: 'apiKeysUpdated',
          keyCount: apiKeys.length 
        }).catch(() => {}); // Ignore errors
        
        console.log(`API Keys saved: ${apiKeys.length} keys`);
      }
    });
  }

  function saveApiKeysWithNotification() {
    tampilkanStatus('Menyimpan API Keys...', 'info');
    
    chrome.storage.sync.set({ 
      'geminiApiKeys': apiKeys,
      'currentKeyIndex': currentKeyIndex 
    }, function() {
      if (chrome.runtime.lastError) {
        tampilkanStatus('❌ Gagal menyimpan API Keys: ' + chrome.runtime.lastError.message, 'error');
      } else {
        updateRoundRobinInfo();
        renderApiKeys(); // Re-render to reset "Modified" status
        
        // Notify background script that API keys are updated
        chrome.runtime.sendMessage({ 
          action: 'apiKeysUpdated',
          keyCount: apiKeys.length 
        }, function(response) {
          if (response && response.status === 'tabs_notified') {
            tampilkanStatus(`✅ ${apiKeys.length} API Keys berhasil disimpan dan semua tab telah diberitahu!`, 'success');
          } else {
            tampilkanStatus(`✅ ${apiKeys.length} API Keys berhasil disimpan!`, 'success');
          }
        });
        
        console.log(`API Keys saved with notification: ${apiKeys.length} keys`);
      }
    });
  }

  function updateRoundRobinInfo() {
    if (apiKeys.length === 0) {
      roundRobinInfo.textContent = 'Belum ada API key';
      return;
    }
    
    const validKeys = apiKeysContainer.querySelectorAll('.api-key-item.valid').length;
    const currentKeyDisplay = apiKeys[currentKeyIndex] ? 
      `Key ${currentKeyIndex + 1} (${apiKeys[currentKeyIndex].substring(0, 12)}...)` : 
      `Key ${currentKeyIndex + 1}`;
    
    roundRobinInfo.innerHTML = `
      Total: ${apiKeys.length} keys | 
      Valid: ${validKeys} keys | 
      Current: ${currentKeyDisplay}
    `;
  }

  function saveCustomShortcuts() {
    const shortcuts = {
      scanFull: shortcutScanFull.value,
      snipping: shortcutSnipping.value,
      toggleMenu: shortcutToggleMenu.value
    };

    chrome.storage.sync.set({ 'customShortcuts': shortcuts }, function() {
      if (chrome.runtime.lastError) {
        tampilkanStatus('Gagal menyimpan shortcuts: ' + chrome.runtime.lastError.message, 'error');
      } else {
        tampilkanStatus('Custom shortcuts berhasil disimpan!', 'success');
        updateShortcutDisplay(shortcuts);
        
        // Notify all tabs tentang perubahan shortcuts
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'updateShortcuts',
                shortcuts: shortcuts
              }).catch(() => {}); // Ignore errors
            }
          });
        });
      }
    });
  }

  function updateShortcutDisplay(shortcuts) {
    const keyMap = {
      'KeyS': 'S', 'KeyA': 'A', 'KeyF': 'F', 'KeyQ': 'Q', 'KeyW': 'W',
      'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T', 'KeyU': 'U', 'KeyI': 'I',
      'KeyO': 'O', 'KeyP': 'P', 'KeyZ': 'Z', 'KeyX': 'X', 'KeyC': 'C',
      'KeyV': 'V', 'KeyB': 'B', 'KeyN': 'N', 'KeyM': 'M', 'KeyD': 'D',
      'KeyG': 'G', 'KeyH': 'H', 'KeyJ': 'J', 'KeyK': 'K', 'KeyL': 'L',
      'KeyY': 'Y', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3'
    };

    currentScanShortcut.textContent = `Ctrl+Shift+${keyMap[shortcuts.scanFull] || shortcuts.scanFull}`;
    currentSnippingShortcut.textContent = `Ctrl+Shift+${keyMap[shortcuts.snipping] || shortcuts.snipping}`;
    currentToggleShortcut.textContent = `Ctrl+Shift+${keyMap[shortcuts.toggleMenu] || shortcuts.toggleMenu}`;
  }

  // Fungsi helper untuk tampilkan status
  function tampilkanStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = '';
    
    switch(type) {
      case 'success':
        statusDiv.style.color = '#28a745';
        break;
      case 'error':
        statusDiv.style.color = '#dc3545';
        break;
      case 'warning':
        statusDiv.style.color = '#ffc107';
        break;
      case 'info':
      default:
        statusDiv.style.color = '#17a2b8';
        break;
    }

    // Auto clear setelah 5 detik untuk success dan error
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = '';
        }
      }, 5000);
    }
  }
});