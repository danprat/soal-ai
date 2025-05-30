// Gemini API Key - ideally, this should be stored securely and fetched
// For now, we'll try to get it from chrome.storage.sync
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=';

async function getApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKeys', 'currentKeyIndex', 'geminiApiKey'], function(result) {
      // Handle legacy single API key
      if (result.geminiApiKey && !result.geminiApiKeys) {
        const apiKeys = [result.geminiApiKey];
        // Migrate to new format
        chrome.storage.sync.set({ 'geminiApiKeys': apiKeys });
        chrome.storage.sync.remove('geminiApiKey');
        resolve({ apiKeys, currentKeyIndex: 0 });
      } else {
        resolve({
          apiKeys: result.geminiApiKeys || [],
          currentKeyIndex: result.currentKeyIndex || 0
        });
      }
    });
  });
}

async function getNextApiKey() {
  const { apiKeys, currentKeyIndex } = await getApiKeys();
  
  if (apiKeys.length === 0) {
    return null;
  }
  
  // Return current key
  const currentKey = apiKeys[currentKeyIndex];
  
  // Move to next key for round-robin (cycle back to 0 if at end)
  const nextIndex = (currentKeyIndex + 1) % apiKeys.length;
  
  // Save next index for future use
  chrome.storage.sync.set({ 'currentKeyIndex': nextIndex });
  
  console.log(`Using API Key ${currentKeyIndex + 1}/${apiKeys.length} for request`);
  
  return currentKey;
}

async function tryApiKeyWithFallback(imageData, maxRetries = 3) {
  const { apiKeys } = await getApiKeys();
  
  if (apiKeys.length === 0) {
    throw new Error('No API keys available');
  }
  
  let lastError = null;
  let attempts = 0;
  
  // Try up to maxRetries or all available keys, whichever is smaller
  const maxAttempts = Math.min(maxRetries, apiKeys.length);
  
  while (attempts < maxAttempts) {
    try {
      const apiKey = await getNextApiKey();
      
      if (!apiKey || apiKey.trim() === '') {
        attempts++;
        continue;
      }
      
      console.log(`Attempt ${attempts + 1}/${maxAttempts} with API key ${apiKey.substring(0, 12)}...`);
      
      const result = await makeGeminiRequest(imageData, apiKey);
      
      // If successful, return result
      console.log(`✅ Success with API key ${apiKey.substring(0, 12)}...`);
      return result;
      
    } catch (error) {
      console.log(`❌ Failed with API key attempt ${attempts + 1}: ${error.message}`);
      lastError = error;
      attempts++;
      
      // If it's a quota/rate limit error, try next key immediately
      if (error.status === 429 || error.status === 403) {
        console.log('Quota/rate limit hit, trying next API key...');
        continue;
      }
      
      // For other errors, still try next key but with slight delay
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // All keys failed
  throw new Error(`All API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

async function makeGeminiRequest(base64ImageData, apiKey) {
  const payload = {
    contents: [
      {
        parts: [
          { 
            text: "Kamu adalah AI solver soal. Baca soal di gambar ini dan berikan jawaban LANGSUNG:\n\n- Pilihan ganda: tulis huruf DAN isi jawabannya (contoh: B. Kucing)\n- Perhitungan: tulis hasil akhirnya saja (contoh: 25)\n- True/False: tulis True atau False\n- Essay singkat: maksimal 1-2 kalimat\n\nJANGAN beri penjelasan panjang, rumus, atau langkah. Format jawaban harus singkat dan tepat." 
          },
          {
            inline_data: {
              mime_type: "image/png",
              data: base64ImageData
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 10,
      topP: 0.7,
      maxOutputTokens: 300
    }
  };

  const response = await fetch(GEMINI_API_URL + apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  
  if (!result.candidates || !result.candidates[0] || 
      !result.candidates[0].content || !result.candidates[0].content.parts ||
      !result.candidates[0].content.parts[0] || !result.candidates[0].content.parts[0].text) {
    throw new Error('No valid response from Gemini API');
  }

  return result.candidates[0].content.parts[0].text.trim();
}

async function getOverlaySetting() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['overlayEnabled'], function(result) {
      // Default true jika belum pernah diset
      resolve(result.overlayEnabled !== false);
    });
  });
}

async function getCustomShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['customShortcuts'], function(result) {
      resolve(result.customShortcuts || {
        scanFull: 'KeyS',
        snipping: 'KeyA',
        toggleMenu: 'KeyF'
      });
    });
  });
}

// Command listener untuk keyboard shortcuts (deprecated, sekarang pake content script)
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  if (command === 'scan-full-page') {
    // Trigger scan full page
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'scanFullPage'});
    }
  } else if (command === 'snipping-tool') {
    // Trigger snipping tool
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'startSnipping'});
    }
  } else if (command === 'toggle-floating-menu') {
    // Toggle floating menu
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleFloatingMenu'});
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
    sendResponse({ status: 'settings_opened' });
    return true;
  }

  if (request.action === 'apiKeysUpdated') {
    console.log(`API Keys updated: ${request.keyCount} keys`);
    // Notify all tabs immediately
    notifyAllTabsApiKeysReady();
    
    // Also notify popup if it's open
    chrome.runtime.sendMessage({ 
      action: 'updatePopupStatus', 
      status: 'api_keys_updated',
      keyCount: request.keyCount 
    }).catch(() => {}); // Ignore errors if popup not open
    
    sendResponse({ status: 'tabs_notified' });
    return true;
  }
  
  if (request.action === 'requestApiKeyStatus') {
    (async () => {
      try {
        const { apiKeys } = await getApiKeys();
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'apiKeysReady',
            keyCount: apiKeys.length
          });
        }
        sendResponse({ status: 'status_sent', keyCount: apiKeys.length });
      } catch (error) {
        console.error('Error getting API key status:', error);
        sendResponse({ status: 'error', message: error.message });
      }
    })();
    return true;
  }
  
  if (request.action === 'captureScreenshot') {
    (async () => {
      try {
        const { apiKeys } = await getApiKeys();
        if (apiKeys.length === 0) {
          console.error('No Gemini API Keys found in storage.');
          
          // Kirim error ke content script untuk overlay
          if (sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showErrorOverlay',
              message: 'Belum ada API Key. Klik icon extension dan pilih Settings untuk menambah API Key.',
              title: 'API Key Diperlukan'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: 'No API Keys',
            message: 'Please add Gemini API Keys in the extension options.'
          });
          sendResponse({ status: 'no_api_keys' });
          return;
        }

        sendResponse({ status: 'processing' });

        // Check overlay setting
        const overlayEnabled = await getOverlaySetting();

        if (overlayEnabled && sender.tab) {
          // Tampilkan loading overlay di halaman web
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showLoadingOverlay',
            message: `Memproses dengan AI (${apiKeys.length} keys available)...`
          });
        }

        try {
          // Capture dengan kualitas tinggi untuk akurasi maksimal
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { 
            format: 'png'  // PNG untuk kualitas teks yang lebih baik
          });
          
          // Ekstrak base64 data
          const base64ImageData = dataUrl.split(',')[1];
          
          // Hanya kompres jika file sangat besar
          const optimizedBase64 = base64ImageData.length > 500000 ? 
            compressBase64Image(base64ImageData) : base64ImageData;

          // Try with round-robin fallback
          const answer = await tryApiKeyWithFallback(optimizedBase64);
          
          // Clean up jawaban untuk lebih ringkas
          const cleanAnswer = answer.replace(/^(Jawaban|Answer|Penjelasan):\s*/i, '')
                                   .replace(/\n\n+/g, '\n');

          if (overlayEnabled && sender.tab) {
            // Kirim jawaban ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showAnswerOverlay',
              answer: cleanAnswer,
              title: 'Jawaban Ditemukan! 🎯'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Jawaban Ditemukan!',
            message: cleanAnswer.substring(0, 100) + (cleanAnswer.length > 100 ? '...' : '')
          });
          
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'success', answer: cleanAnswer });

        } catch (error) {
          console.error('Error in image processing:', error);
          const errorMessage = error.message || 'Terjadi kesalahan tak terduga.';
          
          if (overlayEnabled && sender.tab) {
            // Kirim error ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showErrorOverlay',
              message: `❌ ${errorMessage}`,
              title: 'AI Processing Error'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon48.png',
            title: 'Processing Error',
            message: errorMessage
          });
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'error', message: errorMessage });
        }

      } catch (error) {
        console.error('Critical error:', error);
        sendResponse({ status: 'critical_error', message: error.message });
      }
    })();
    return true;
  }

  if (request.action === 'captureSelectedArea') {
    console.log('Capturing selected area:', request.selection);
    (async () => {
      try {
        const { apiKeys } = await getApiKeys();
        if (apiKeys.length === 0) {
          const overlayEnabled = await getOverlaySetting();
          
          if (overlayEnabled && sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showErrorOverlay',
              message: 'Belum ada API Key. Klik icon extension dan pilih Settings untuk menambah API Key.',
              title: 'API Key Diperlukan'
            });
          }
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'error', message: 'Belum ada API Keys' });
          return;
        }

        // Check overlay setting
        const overlayEnabled = await getOverlaySetting();

        if (overlayEnabled && sender.tab) {
          // Tampilkan loading overlay di halaman web
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'showLoadingOverlay',
            message: `Memproses area yang dipilih (${apiKeys.length} keys)...`
          });
        }

        try {
          // Capture full page first
          console.log('Taking screenshot...');
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          
          // Extract base64 data
          const base64ImageData = dataUrl.split(',')[1];
          console.log('Screenshot captured, processing with AI...');
          
          // Try with round-robin fallback
          const answer = await tryApiKeyWithFallback(base64ImageData);
          
          // Clean up jawaban
          const cleanAnswer = answer.replace(/^(Jawaban|Answer|Penjelasan):\s*/i, '')
                                   .replace(/\n\n+/g, '\n');

          if (overlayEnabled && sender.tab) {
            // Kirim jawaban ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showAnswerOverlay',
              answer: cleanAnswer,
              title: 'Area Scan Complete! 📐'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Area Scan Complete!',
            message: cleanAnswer.substring(0, 100) + (cleanAnswer.length > 100 ? '...' : '')
          });
          
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'success', answer: cleanAnswer });

        } catch (error) {
          console.error('Error capturing selected area:', error);
          
          if (overlayEnabled && sender.tab) {
            // Kirim error ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showErrorOverlay',
              message: `❌ ${error.message}`,
              title: 'Scan Error'
            });
          }
          
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'error', message: error.message });
        }

      } catch (error) {
        console.error('Critical error in selected area capture:', error);
      }
    })();
    return true;
  } else if (request.action === 'snippingCancelled') {
    console.log('Snipping cancelled');
    chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'info', message: 'Snipping dibatalkan' });
    return true;
  }
});

// Fungsi untuk kompres base64 image dengan cara sederhana
function compressBase64Image(base64Data, quality = 0.8) {
  // Untuk service worker, kita hanya bisa lakukan kompresi sederhana
  // dengan mengurangi panjang string atau menggunakan method lain
  
  // Cara sederhana: ambil setiap nth character untuk reduksi size
  // Ini tidak ideal tapi work-around untuk service worker limitation
  if (base64Data.length > 100000) { // Jika file besar
    // Sample setiap 2 karakter untuk kompresi basic
    let compressed = '';
    for (let i = 0; i < base64Data.length; i += 2) {
      compressed += base64Data[i];
      if (i + 1 < base64Data.length) {
        compressed += base64Data[i + 1];
      }
    }
    return compressed;
  }
  
  return base64Data; // Return original jika sudah kecil
}

// Listener for when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // On first install, you might want to open an options page or a welcome page.
    // For now, let's check if an API key is set and if not, prompt.
    getApiKeys().then(({ apiKeys }) => {
      if (apiKeys.length === 0) {
        // If you create an options page, open it here:
        chrome.runtime.openOptionsPage();
        // For now, a notification:
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon48.png',
          title: 'Setup Required',
          message: 'Please add your Gemini API Keys to use Soal Scanner AI with round-robin load balancing.'
        });
      } else {
        notifyAllTabsApiKeysReady();
      }
    });
  }
});

// Function to notify all tabs that API keys are ready
async function notifyAllTabsApiKeysReady() {
  const { apiKeys } = await getApiKeys();
  
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'apiKeysReady',
          keyCount: apiKeys.length
        }).catch(() => {}); // Ignore errors untuk tabs yang tidak support
      }
    });
  });
  
  console.log(`✅ Notified all tabs: ${apiKeys.length} API keys ready for round-robin`);
}

// Listen for storage changes to notify tabs when API keys are updated
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.geminiApiKeys) {
    console.log('API Keys changed, notifying all tabs...');
    notifyAllTabsApiKeysReady();
  }
});

console.log("Background script loaded with multi-API key round-robin support.");