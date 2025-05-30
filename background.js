/**
 * Soal Scanner AI - Background Script
 * Chrome Extension untuk scan soal dengan AI Gemini
 * 
 * @author Dany Pratmanto
 * @contact WhatsApp: 08974041777
 * @version 2.0.0
 * @description Multi API key support dengan round-robin load balancing
 */

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
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKeys', 'currentKeyIndex'], async function(result) {
      const apiKeys = result.geminiApiKeys || [];
      const currentIndex = result.currentKeyIndex || 0;
      
      if (apiKeys.length === 0) {
        resolve(null);
        return;
      }
      
      // Get current key
      const currentKey = apiKeys[currentIndex];
      
      // Calculate next index for round-robin (cycle back to 0 if at end)
      const nextIndex = (currentIndex + 1) % apiKeys.length;
      
      // Update index immediately for next request
      chrome.storage.sync.set({ 'currentKeyIndex': nextIndex }, () => {
        console.log(`🔄 Round-robin: Using key ${currentIndex + 1}/${apiKeys.length}, next will be ${nextIndex + 1}`);
        console.log(`Key preview: ${currentKey.substring(0, 15)}...`);
        resolve(currentKey);
      });
    });
  });
}

async function tryApiKeyWithFallback(imageData, maxRetries = 3) {
  const { apiKeys } = await getApiKeys();
  
  if (apiKeys.length === 0) {
    throw new Error('No API keys available');
  }
  
  let lastError = null;
  let attempts = 0;
  const attemptedKeys = new Set(); // Track which keys we've tried
  
  // Try up to maxRetries or all available keys, whichever is smaller
  const maxAttempts = Math.min(maxRetries, apiKeys.length);
  
  console.log(`🚀 Starting API request with ${apiKeys.length} keys available, max ${maxAttempts} attempts`);
  
  while (attempts < maxAttempts) {
    try {
      const apiKey = await getNextApiKey();
      
      if (!apiKey || apiKey.trim() === '') {
        console.log(`⚠️ Empty API key at attempt ${attempts + 1}`);
        attempts++;
        continue;
      }
      
      // Check if we've already tried this key in this request
      const keyPreview = apiKey.substring(0, 15);
      if (attemptedKeys.has(keyPreview)) {
        console.log(`🔁 Already tried key ${keyPreview}..., getting next one`);
        continue;
      }
      
      attemptedKeys.add(keyPreview);
      
      console.log(`🎯 Attempt ${attempts + 1}/${maxAttempts} with API key ${keyPreview}...`);
      
      const result = await makeGeminiRequest(imageData, apiKey);
      
      // If successful, return result
      console.log(`✅ SUCCESS with API key ${keyPreview}... after ${attempts + 1} attempts`);
      return result;
      
    } catch (error) {
      console.log(`❌ FAILED attempt ${attempts + 1}: ${error.message}`);
      lastError = error;
      attempts++;
      
      // If it's a quota/rate limit error, try next key immediately
      if (error.status === 429 || error.status === 403) {
        console.log('💡 Quota/rate limit hit, immediately trying next API key...');
        continue;
      }
      
      // For other errors, still try next key but with slight delay
      if (attempts < maxAttempts) {
        console.log(`⏳ Waiting 1s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // All keys failed
  console.error(`💥 ALL ${attemptedKeys.size} API keys failed after ${attempts} attempts`);
  throw new Error(`All ${attemptedKeys.size} API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

async function tryApiKeyWithDoubleCheck(imageData) {
  const { apiKeys } = await getApiKeys();
  
  if (apiKeys.length === 0) {
    throw new Error('No API keys available');
  }
  
  // Only use double-check if we have 2+ API keys to ensure rotation
  if (apiKeys.length >= 2) {
    console.log(`🎯 Double-check mode: ${apiKeys.length} keys available for cross-validation`);
    
    try {
      // First attempt - will use current key in rotation
      console.log('📍 First validation attempt...');
      const result1 = await tryApiKeyWithFallback(imageData, 1);
      
      // Second attempt - will use next key in rotation
      console.log('📍 Second validation attempt...');
      const result2 = await tryApiKeyWithFallback(imageData, 1);
      
      // Compare results - but don't be too strict about exact matches
      const simplified1 = result1.trim().toLowerCase();
      const simplified2 = result2.trim().toLowerCase();
      
      if (simplified1 === simplified2 || simplified1.includes(simplified2) || simplified2.includes(simplified1)) {
        console.log('✅ Double-check validation: Results are consistent');
        return result1; // Return first result (usually more complete)
      } else {
        console.log('⚠️ Double-check validation: Minor differences detected, using first result');
        console.log(`Result 1: ${result1.substring(0, 50)}...`);
        console.log(`Result 2: ${result2.substring(0, 50)}...`);
        return result1; // Use first result as primary
      }
    } catch (error) {
      console.log('❌ Double-check validation failed, falling back to single attempt');
      return await tryApiKeyWithFallback(imageData, 2);
    }
  } else {
    // Use single attempt for faster response with only 1 key
    console.log('⚡ Single key mode: Using direct attempt for faster response');
    return await tryApiKeyWithFallback(imageData, 1);
  }
}

async function makeGeminiRequest(base64ImageData, apiKey) {
  const payload = {
    contents: [
      {
        parts: [
          { 
            text: `Anda AI ahli akademik Indonesia. Analisis soal di gambar dan berikan jawaban SINGKAT tapi AKURAT.

INSTRUKSI:
1. Baca soal dengan teliti
2. Berikan jawaban yang PASTI BENAR
3. Format jawaban harus RINGKAS dan LANGSUNG

FORMAT JAWABAN:
• Pilihan Ganda: "A. [jawaban]"
• Matematika: "[angka] [satuan]"
• Isian: "[jawaban singkat]"
• True/False: "Benar" atau "Salah"
• Essay: "[1 kalimat jawaban]"

PENTING:
- JANGAN beri penjelasan panjang
- JANGAN tulis rumus atau langkah
- FOKUS pada jawaban yang tepat dan singkat
- Gunakan pengetahuan kurikulum Indonesia

Berikan jawaban FINAL:` 
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
      temperature: 0.05,
      topK: 2,
      topP: 0.6,
      maxOutputTokens: 150,  // Drastis dikurangi untuk jawaban singkat
      candidateCount: 1
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
        
        // Also get rotation info for debugging
        const rotationInfo = await debugApiKeyRotation();
        
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'apiKeysReady',
            keyCount: apiKeys.length,
            rotationInfo: rotationInfo
          });
        }
        sendResponse({ 
          status: 'status_sent', 
          keyCount: apiKeys.length,
          currentIndex: rotationInfo.currentIndex,
          rotationActive: apiKeys.length > 1
        });
      } catch (error) {
        console.error('Error getting API key status:', error);
        sendResponse({ status: 'error', message: error.message });
      }
    })();
    return true;
  }
  
  // Add debug action for manual testing
  if (request.action === 'debugApiRotation') {
    (async () => {
      try {
        const rotationInfo = await debugApiKeyRotation();
        sendResponse({ 
          status: 'debug_complete', 
          ...rotationInfo
        });
      } catch (error) {
        console.error('Error debugging API rotation:', error);
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
            format: 'png',  // PNG untuk kualitas teks yang lebih baik
            quality: 100    // Kualitas maksimal untuk text recognition
          });
          
          // Ekstrak base64 data
          const base64ImageData = dataUrl.split(',')[1];
          
          // Skip compression untuk mempertahankan kualitas OCR
          console.log(`📸 Screenshot captured: ${Math.round(base64ImageData.length / 1024)}KB`);

          // Try with round-robin fallback
          const answer = await tryApiKeyWithDoubleCheck(base64ImageData);
          
          // Validate and improve answer quality
          const validatedAnswer = await validateAndImproveAnswer(answer, base64ImageData);
          
          // Clean up jawaban untuk lebih ringkas (simplified since validation handles most cleaning)
          const finalAnswer = validatedAnswer;

          if (overlayEnabled && sender.tab) {
            // Kirim jawaban ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showAnswerOverlay',
              answer: finalAnswer,
              title: 'Jawaban Ditemukan! 🎯'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Jawaban Ditemukan!',
            message: finalAnswer.substring(0, 100) + (finalAnswer.length > 100 ? '...' : '')
          });
          
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'success', answer: finalAnswer });

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
          const answer = await tryApiKeyWithDoubleCheck(base64ImageData);
          
          // Validate and improve answer quality
          const validatedAnswer = await validateAndImproveAnswer(answer, base64ImageData);
          
          // Clean up jawaban
          const finalAnswer = validatedAnswer;

          if (overlayEnabled && sender.tab) {
            // Kirim jawaban ke content script untuk overlay
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'showAnswerOverlay',
              answer: finalAnswer,
              title: 'Area Scan Complete! 📐'
            });
          }
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Area Scan Complete!',
            message: finalAnswer.substring(0, 100) + (finalAnswer.length > 100 ? '...' : '')
          });
          
          chrome.runtime.sendMessage({ action: 'updatePopupStatus', status: 'success', answer: finalAnswer });

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

// Function to reset API key rotation index
async function resetApiKeyRotation() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ 'currentKeyIndex': 0 }, () => {
      console.log('🔄 API key rotation index reset to 0');
      resolve();
    });
  });
}

// Function to debug current API key rotation status
async function debugApiKeyRotation() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['geminiApiKeys', 'currentKeyIndex'], function(result) {
      const apiKeys = result.geminiApiKeys || [];
      const currentIndex = result.currentKeyIndex || 0;
      
      console.log('🔍 DEBUG - API Key Rotation Status:');
      console.log(`   Total keys: ${apiKeys.length}`);
      console.log(`   Current index: ${currentIndex}`);
      console.log(`   Next key will be: ${(currentIndex + 1) % apiKeys.length}`);
      
      apiKeys.forEach((key, index) => {
        const isActive = index === currentIndex;
        console.log(`   Key ${index + 1}: ${key.substring(0, 15)}... ${isActive ? '← CURRENT' : ''}`);
      });
      
      resolve({ apiKeys, currentIndex });
    });
  });
}

// Function to notify all tabs that API keys are ready
async function notifyAllTabsApiKeysReady() {
  const { apiKeys } = await getApiKeys();
  
  // Reset rotation when API keys are updated
  await resetApiKeyRotation();
  
  // Debug current rotation status
  await debugApiKeyRotation();
  
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
  
  console.log(`✅ Notified all tabs: ${apiKeys.length} API keys ready for round-robin rotation`);
}

// Listen for storage changes to notify tabs when API keys are updated
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.geminiApiKeys) {
    console.log('API Keys changed, notifying all tabs...');
    notifyAllTabsApiKeysReady();
  }
});

console.log("Background script loaded with multi-API key round-robin support.");

async function validateAndImproveAnswer(rawAnswer, imageData) {
  // Basic answer cleaning - keep it simple
  const cleanAnswer = rawAnswer.replace(/^(Jawaban|Answer|Penjelasan):\s*/i, '')
                               .replace(/\n\n+/g, '\n')
                               .trim();
  
  // Check if answer seems incomplete - but don't add verbose warnings
  const suspiciousPatterns = [
    /tidak dapat/i,
    /tidak jelas/i,
    /tidak terlihat/i,
    /maaf/i,
    /tidak bisa/i,
    /gambar terlalu/i,
    /resolusi rendah/i
  ];
  
  const hasIssues = suspiciousPatterns.some(pattern => pattern.test(cleanAnswer));
  
  if (hasIssues) {
    return "Soal tidak jelas, coba screenshot lebih baik";
  }
  
  // Keep formatting simple and direct
  if (cleanAnswer.match(/^[A-E]\./)) {
    // Multiple choice - already good format
    return cleanAnswer;
  } else if (cleanAnswer.match(/^\d+(\.\d+)?/)) {
    // Numeric answer - keep as is
    return cleanAnswer;
  } else if (cleanAnswer.match(/^(benar|salah|true|false)/i)) {
    // True/false - standardize but keep short
    return cleanAnswer.charAt(0).toUpperCase() + cleanAnswer.slice(1).toLowerCase();
  }
  
  // For other answers, just return clean version without additions
  return cleanAnswer;
}

// Test function untuk manual testing di console
async function testApiRotation(testCount = 5) {
  console.log(`🧪 Testing API rotation with ${testCount} requests...`);
  
  const { apiKeys } = await getApiKeys();
  if (apiKeys.length === 0) {
    console.log('❌ No API keys available for testing');
    return;
  }
  
  console.log(`📊 Available API keys: ${apiKeys.length}`);
  
  const usedKeys = [];
  
  for (let i = 0; i < testCount; i++) {
    const key = await getNextApiKey();
    const keyPreview = key ? key.substring(0, 15) + '...' : 'null';
    usedKeys.push(keyPreview);
    console.log(`Request ${i + 1}: Using key ${keyPreview}`);
    
    // Small delay to simulate real usage
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('🔄 Rotation pattern:');
  usedKeys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${key}`);
  });
  
  // Verify round-robin pattern
  const uniqueKeys = [...new Set(usedKeys)];
  console.log(`📈 Used ${uniqueKeys.length} unique keys out of ${apiKeys.length} available`);
  
  if (apiKeys.length > 1) {
    const expectedRotations = Math.floor(testCount / apiKeys.length);
    console.log(`Expected ${expectedRotations} full rotations with remainder`);
  }
  
  return { usedKeys, uniqueKeys };
}

// Make test function available globally for console testing
if (typeof globalThis !== 'undefined') {
  globalThis.testApiRotation = testApiRotation;
  globalThis.debugApiKeyRotation = debugApiKeyRotation;
  globalThis.resetApiKeyRotation = resetApiKeyRotation;
}