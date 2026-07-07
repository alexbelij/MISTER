/**
 * MISTER Mobile — App Logic
 * 
 * Handles: chat, camera (OCR/VLM), voice (STT/TTS), QR, settings
 * Communicates with Pear worker (mobile/worker.js) for QVAC SDK calls
 */

// --- State ---
let currentTab = 'chat';
let cameraMode = 'ocr'; // 'ocr' or 'vlm'
let cameraStream = null;
let isRecording = false;
let lastTranscript = '';
let adapterLoaded = false;
let delegateConnected = false;

// --- Tab switching ---
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  ['chat', 'camera', 'voice', 'settings'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  
  // Show/hide chat input bar
  document.getElementById('chatInputBar').style.display = tab === 'chat' ? 'flex' : 'none';
  
  // Start/stop camera
  if (tab === 'camera') startCamera();
  else stopCamera();
}

// --- Chat ---
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  
  const messages = document.getElementById('chatMessages');
  messages.innerHTML += `<div class="chat-msg user"><div class="role">You</div><div class="bubble">${escapeHtml(msg)}</div></div>`;
  input.value = '';
  messages.scrollTop = messages.scrollHeight;
  
  // Show loading
  messages.innerHTML += `<div class="chat-msg assistant" id="loadingMsg"><div class="role">Club Brain</div><div class="bubble"><span class="spinner"></span></div></div>`;
  messages.scrollTop = messages.scrollHeight;
  
  try {
    // Send to worker (Pear) or show instructions
    if (typeof Pear !== 'undefined' && Pear.worker) {
      const response = await Pear.worker.postMessage({ type: 'chat', message: msg });
      document.getElementById('loadingMsg').remove();
      messages.innerHTML += `<div class="chat-msg assistant"><div class="role">Club Brain</div><div class="bubble">${escapeHtml(response.text)}</div>${response.ragHits ? `<div class="rag">[${response.ragHits} RAG sources, ${response.timeMs}ms]</div>` : ''}</div>`;
    } else {
      document.getElementById('loadingMsg').remove();
      messages.innerHTML += `<div class="chat-msg assistant"><div class="role">Club Brain</div><div class="bubble">[Run in Pear app for live chat. Terminal: npm run chat]</div></div>`;
    }
  } catch (e) {
    document.getElementById('loadingMsg').remove();
    messages.innerHTML += `<div class="chat-msg assistant"><div class="role">Club Brain</div><div class="bubble">Error: ${escapeHtml(e.message)}</div></div>`;
  }
  
  messages.scrollTop = messages.scrollHeight;
}

// --- Camera ---
function selectMode(mode) {
  cameraMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    document.getElementById('cameraVideo').srcObject = cameraStream;
  } catch (e) {
    document.getElementById('cameraResult').innerHTML = `<div class="ocr-result">Camera not available: ${e.message}</div>`;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('captureCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  canvas.toBlob(async (blob) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = new Uint8Array(reader.result);
      document.getElementById('cameraResult').innerHTML = '<div class="ocr-result"><span class="spinner"></span> Processing...</div>';
      
      try {
        if (typeof Pear !== 'undefined' && Pear.worker) {
          const result = await Pear.worker.postMessage({ type: cameraMode, image: imageData });
          document.getElementById('cameraResult').innerHTML = `<div class="ocr-result"><strong>${cameraMode === 'ocr' ? 'Extracted Text' : 'Tactical Analysis'}:</strong><br>${escapeHtml(result.text)}</div>`;
        } else {
          document.getElementById('cameraResult').innerHTML = `<div class="ocr-result">[Run in Pear app for camera OCR. Terminal: npm run ocr -- --image <file>]</div>`;
        }
      } catch (e) {
        document.getElementById('cameraResult').innerHTML = `<div class="ocr-result">Error: ${e.message}</div>`;
      }
    };
    reader.readAsArrayBuffer(blob);
  }, 'image/jpeg', 0.9);
}

// --- Voice ---
async function toggleRecording() {
  const micBtn = document.getElementById('micBtn');
  const status = document.getElementById('recordingStatus');
  
  if (!isRecording) {
    isRecording = true;
    micBtn.classList.add('recording');
    status.textContent = 'Recording... Tap to stop';
    document.getElementById('transcriptDisplay').textContent = '';
    lastTranscript = '';
    
    try {
      if (typeof Pear !== 'undefined' && Pear.worker) {
        Pear.worker.postMessage({ type: 'sttStream' });
      }
    } catch (e) {
      status.textContent = 'Microphone not available';
    }
  } else {
    isRecording = false;
    micBtn.classList.remove('recording');
    status.textContent = 'Tap to start recording';
  }
}

function sendToChat() {
  if (!lastTranscript) return;
  document.getElementById('chatInput').value = lastTranscript;
  switchTab('chat');
  sendMessage();
}

// --- Settings ---
function loadAdapter() {
  alert('In Pear app: file picker for .gguf adapter\nTerminal: npm run chat -- --adapter <path>');
}

function showQR() {
  alert('Generate QR with P2P topic key for adapter sharing');
}

function scanQR() {
  alert('Scan QR to receive adapter from another device');
}

function connectDelegate() {
  alert('Connect to laptop for P2P inference delegation\nTerminal: npm run delegate -- --client --topic <key>');
}

function setPassword() {
  alert('Set password for AES-256 encryption of club data');
}

function exportData() {
  alert('Export all club data (GDPR right to portability)\nTerminal: node -e "require(\'./src/security/crypto\').exportAllData()"');
}

function deleteAllData() {
  if (confirm('Delete ALL club data? This cannot be undone. (GDPR right to erasure)')) {
    alert('All data will be securely deleted (overwrite + delete)');
  }
}

// --- Helpers ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  // Check if running in Pear
  if (typeof Pear !== 'undefined') {
    document.getElementById('statusDot').className = 'status-dot ready';
    document.getElementById('statusText').textContent = 'On-device';
  } else {
    document.getElementById('statusDot').className = 'status-dot idle';
    document.getElementById('statusText').textContent = 'Preview mode';
  }
});
