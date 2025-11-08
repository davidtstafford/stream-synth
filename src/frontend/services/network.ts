/**
 * Network utilities for getting local IP addresses and browser source URLs
 */

const os = window.require('os');

/**
 * Get the local IP address of this machine
 */
export function getLocalIPAddress(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    
    // Look for the first non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Network] Error getting local IP:', error);
    return null;
  }
}

/**
 * Get browser source URLs for a given path
 */
export function getBrowserSourceURLs(path: string = '', port: number = 3737): {
  localhost: string;
  localIP: string | null;
} {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return {
    localhost: `http://localhost:${port}${cleanPath}`,
    localIP: getLocalIPAddress() ? `http://${getLocalIPAddress()}:${port}${cleanPath}` : null
  };
}

/**
 * Get all browser source URLs for TTS
 */
export function getTTSBrowserSourceURLs(port: number = 3737) {
  return getBrowserSourceURLs('/browser-source/tts', port);
}

/**
 * Get all browser source URLs for general use (alerts, entrance sounds, etc.)
 */
export function getGeneralBrowserSourceURLs(port: number = 3737) {
  return getBrowserSourceURLs('/browser-source', port);
}

/**
 * Get all browser source URLs specifically for entrance sounds
 */
export function getEntranceSoundsBrowserSourceURLs(port: number = 3737) {
  return getBrowserSourceURLs('/browser-source/entrance-sounds', port);
}
