
/* ========================================
   BROWSER SOURCE CLIENT
   Connects to Socket.IO and displays alerts
   ======================================== */

class BrowserSourceClient {
  constructor() {
    this.socket = null;
    this.alertQueue = [];
    this.isProcessing = false;
    this.alertCount = 0;
    this.debugMode = false;
    this.clientId = null;
    
    // DOM elements
    this.alertContainer = null;
    this.statusIndicator = null;
    this.statusText = null;
    this.alertCountEl = null;
    this.queueLengthEl = null;
    this.clientIdEl = null;
    
    // Check for debug mode in URL
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get('debug') === '1';
  }
  
  /**
   * Initialize client
   */
  init() {
    console.log('[BrowserSource] Initializing...');
    
    // Get DOM elements
    this.alertContainer = document.getElementById('alert-container');
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    this.alertCountEl = document.getElementById('alert-count');
    this.queueLengthEl = document.getElementById('queue-length');
    this.clientIdEl = document.getElementById('client-id');
    
    // Show debug info if enabled
    if (this.debugMode) {
      document.getElementById('connection-status').style.display = 'block';
      document.getElementById('debug-info').style.display = 'block';
    }
    
    // Connect to Socket.IO server
    this.connect();
  }
  
  /**
   * Connect to Socket.IO server
   */
  connect() {
    console.log('[BrowserSource] Connecting to server...');
    this.updateStatus('connecting', 'Connecting...');
    
    // Connect to server (default port 3737)
    this.socket = io('http://localhost:3737', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });
    
    // Setup event handlers
    this.setupEventHandlers();
  }
    /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    // Connected
    this.socket.on('connected', (data) => {
      console.log('[BrowserSource] Connected:', data);
      this.clientId = data.clientId;
      this.updateStatus('connected', 'Connected');
      this.updateDebugInfo();
      
      // Expose socket globally in debug mode (after connection)
      if (this.debugMode && window.location.search.includes('debug=1')) {
        window.socket = this.socket;
        console.log('[BrowserSource] ✅ socket is now globally accessible');
      }
    });
    
    // Connection
    this.socket.on('connect', () => {
      console.log('[BrowserSource] Socket connected');
      this.updateStatus('connected', 'Connected');
      
      // Also expose on regular connect event
      if (this.debugMode && window.location.search.includes('debug=1')) {
        window.socket = this.socket;
      }
    });
    
    // Disconnect
    this.socket.on('disconnect', () => {
      console.log('[BrowserSource] Disconnected');
      this.updateStatus('disconnected', 'Disconnected');
    });
    
    // Reconnecting
    this.socket.on('reconnecting', (attemptNumber) => {
      console.log(`[BrowserSource] Reconnecting... (Attempt ${attemptNumber})`);
      this.updateStatus('connecting', `Reconnecting... (${attemptNumber})`);
    });
    
    // Error
    this.socket.on('connect_error', (error) => {
      console.error('[BrowserSource] Connection error:', error);
      this.updateStatus('disconnected', 'Connection Error');
    });
    
    // Alert received
    this.socket.on('alert', (payload) => {
      console.log('[BrowserSource] Alert received:', payload);
      this.handleAlert(payload);
    });
    
    // Pong (health check)
    this.socket.on('pong', (data) => {
      console.log('[BrowserSource] Pong received:', data);
    });
  }
  
  /**
   * Handle incoming alert
   */
  handleAlert(payload) {
    this.alertCount++;
    this.updateDebugInfo();
    
    // Add to queue
    this.alertQueue.push(payload);
    this.updateDebugInfo();
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  /**
   * Process alert queue
   */
  async processQueue() {
    if (this.alertQueue.length === 0) {
      this.isProcessing = false;
      this.updateDebugInfo();
      return;
    }
    
    this.isProcessing = true;
    const payload = this.alertQueue.shift();
    this.updateDebugInfo();
    
    try {
      await this.displayAlert(payload);
    } catch (error) {
      console.error('[BrowserSource] Error displaying alert:', error);
    }
    
    // Process next alert in queue
    this.processQueue();
  }
  
  /**
   * Display alert
   */
  async displayAlert(payload) {
    console.log('[BrowserSource] Displaying alert:', payload);
    
    // Create alert container element
    const alertEl = document.createElement('div');
    alertEl.className = 'alert-item';
    
    // Determine position
    const position = this.getAlertPosition(payload);
    alertEl.classList.add(`position-${position}`);
    
    // Calculate total duration
    let totalDuration = 0;
    
    // Add media elements
    const promises = [];
    
    // Text
    if (payload.text) {
      const textEl = this.createTextElement(payload.text);
      alertEl.appendChild(textEl);
      totalDuration = Math.max(totalDuration, payload.text.duration || 5000);
    }
    
    // Image
    if (payload.image) {
      const imageEl = this.createImageElement(payload.image);
      alertEl.appendChild(imageEl);
      totalDuration = Math.max(totalDuration, payload.image.duration || 5000);
    }
    
    // Video
    if (payload.video) {
      const videoEl = this.createVideoElement(payload.video);
      alertEl.appendChild(videoEl);
      promises.push(this.playVideo(videoEl));
      // Video duration is determined by video length
    }
    
    // Sound
    if (payload.sound) {
      const audioEl = this.createAudioElement(payload.sound);
      alertEl.appendChild(audioEl);
      promises.push(this.playAudio(audioEl));
    }
    
    // Add to DOM
    this.alertContainer.appendChild(alertEl);
    
    // Fade in
    setTimeout(() => {
      alertEl.classList.add('show');
    }, 50);
    
    // Wait for media to load/play
    await Promise.all(promises);
    
    // Wait for duration
    await this.sleep(totalDuration);
    
    // Fade out
    alertEl.classList.remove('show');
    alertEl.classList.add('hide');
    
    // Remove from DOM after fade
    setTimeout(() => {
      if (alertEl.parentNode) {
        alertEl.parentNode.removeChild(alertEl);
      }
    }, 300);
  }
  
  /**
   * Create text element
   */
  createTextElement(textConfig) {
    const textEl = document.createElement('div');
    textEl.className = 'alert-text';
    textEl.innerHTML = textConfig.content;
    
    // Apply custom styles
    if (textConfig.style) {
      Object.assign(textEl.style, textConfig.style);
    }
    
    return textEl;
  }
  
  /**
   * Create image element
   */
  createImageElement(imageConfig) {
    const imageEl = document.createElement('img');
    imageEl.className = 'alert-image';
    imageEl.src = `file://${imageConfig.file_path}`;
    
    if (imageConfig.width) {
      imageEl.style.width = `${imageConfig.width}px`;
    }
    if (imageConfig.height) {
      imageEl.style.height = `${imageConfig.height}px`;
    }
    
    return imageEl;
  }
  
  /**
   * Create video element
   */
  createVideoElement(videoConfig) {
    const videoEl = document.createElement('video');
    videoEl.className = 'alert-video';
    videoEl.src = `file://${videoConfig.file_path}`;
    videoEl.autoplay = true;
    videoEl.muted = false;
    videoEl.volume = videoConfig.volume !== undefined ? videoConfig.volume / 100 : 1.0;
    
    if (videoConfig.width) {
      videoEl.style.width = `${videoConfig.width}px`;
    }
    if (videoConfig.height) {
      videoEl.style.height = `${videoConfig.height}px`;
    }
    
    return videoEl;
  }
  
  /**
   * Create audio element
   */
  createAudioElement(soundConfig) {
    const audioEl = document.createElement('audio');
    audioEl.className = 'alert-audio';
    audioEl.src = `file://${soundConfig.file_path}`;
    audioEl.autoplay = true;
    audioEl.volume = soundConfig.volume !== undefined ? soundConfig.volume / 100 : 1.0;
    
    return audioEl;
  }
  
  /**
   * Play video
   */
  playVideo(videoEl) {
    return new Promise((resolve) => {
      videoEl.addEventListener('ended', resolve);
      videoEl.addEventListener('error', (error) => {
        console.error('[BrowserSource] Video error:', error);
        resolve();
      });
    });
  }
  
  /**
   * Play audio
   */
  playAudio(audioEl) {
    return new Promise((resolve) => {
      audioEl.addEventListener('ended', resolve);
      audioEl.addEventListener('error', (error) => {
        console.error('[BrowserSource] Audio error:', error);
        resolve();
      });
    });
  }
  
  /**
   * Get alert position
   */
  getAlertPosition(payload) {
    // Priority: video > image > text
    if (payload.video?.position) {
      return payload.video.position;
    }
    if (payload.image?.position) {
      return payload.image.position;
    }
    if (payload.text?.position) {
      return payload.text.position;
    }
    return 'top-center'; // Default
  }
  
  /**
   * Update connection status
   */
  updateStatus(status, text) {
    if (!this.statusIndicator || !this.statusText) return;
    
    this.statusIndicator.className = status;
    this.statusText.textContent = text;
  }
  
  /**
   * Update debug info
   */
  updateDebugInfo() {
    if (!this.debugMode) return;
    
    if (this.alertCountEl) {
      this.alertCountEl.textContent = this.alertCount;
    }
    if (this.queueLengthEl) {
      this.queueLengthEl.textContent = this.alertQueue.length;
    }
    if (this.clientIdEl && this.clientId) {
      this.clientIdEl.textContent = this.clientId;
    }
  }
  
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Send test alert request
   */
  sendTestAlert() {
    if (this.socket) {
      console.log('[BrowserSource] Requesting test alert...');
      this.socket.emit('test-alert');
    }
  }
  
  /**
   * Send ping
   */
  sendPing() {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }
}

// ========================================
// INITIALIZE ON PAGE LOAD
// ========================================

let client = null;

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BrowserSource] DOM loaded');
  client = new BrowserSourceClient();
  client.init();
  
  // Expose to global scope for debugging
  window.browserSourceClient = client;
  
  // Note: window.socket will be set after connection is established (see setupEventHandlers)
  
  // Send ping every 30 seconds to keep connection alive
  setInterval(() => {
    if (client && client.socket) {
      client.sendPing();
    }
  }, 30000);
});

// ========================================
// GLOBAL FUNCTIONS (for console debugging)
// ========================================

window.testAlert = () => {
  if (client) {
    client.sendTestAlert();
  }
};

window.getStats = () => {
  if (client) {
    return {
      alertCount: client.alertCount,
      queueLength: client.alertQueue.length,
      isProcessing: client.isProcessing,
      clientId: client.clientId,
      connected: client.socket?.connected
    };
  }
};

// Expose socket globally for debugging (only in debug mode)
window.getSocket = () => {
  return client?.socket;
};

// Helper function to send test alert
window.sendTestAlert = () => {
  if (client?.socket) {
    client.socket.emit('test-alert');
    console.log('[BrowserSource] Test alert requested');
  } else {
    console.error('[BrowserSource] Socket not connected');
  }
};
