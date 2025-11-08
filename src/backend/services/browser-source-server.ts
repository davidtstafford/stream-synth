import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { AlertPayload } from './event-action-processor';
import type { TTSBrowserSourceBridge } from './tts-browser-source-bridge';

/**
 * Browser Source Server
 * 
 * Provides HTTP server for OBS browser source and Socket.IO for real-time alerts.
 * 
 * Features:
 * - HTTP server serves browser-source.html at http://localhost:PORT/browser-source
 * - Socket.IO server broadcasts alerts to connected browser sources
 * - Configurable port (default: 3737)
 * - CORS enabled for OBS browser source
 * - Connection management and stats
 */
export class BrowserSourceServer {
  private httpServer: http.Server | null = null;
  public io: SocketIOServer | null = null;
  private port: number;
  private publicDir: string;
  private connectedClients: Set<string> = new Set();
  private alertsSent: number = 0;
  private ttsBridge: TTSBrowserSourceBridge | null = null;
    constructor(port: number = 3737) {
    this.port = port;
    // Public directory for static files (browser-source.html, etc.)
    // In dev: src/backend/public
    // In prod: dist/backend/public
    this.publicDir = path.join(__dirname, '..', 'public');
    
    // Log the resolved path for debugging
    console.log('[BrowserSourceServer] Public directory:', this.publicDir);
    console.log('[BrowserSourceServer] Public directory exists:', fs.existsSync(this.publicDir));
  }
  
  /**
   * Start HTTP and Socket.IO servers
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = http.createServer((req, res) => {
          this.handleHttpRequest(req, res);
        });
        
        // Create Socket.IO server with CORS enabled
        this.io = new SocketIOServer(this.httpServer, {
          cors: {
            origin: '*', // Allow OBS browser source
            methods: ['GET', 'POST']
          },
          transports: ['websocket', 'polling']
        });
        
        // Setup Socket.IO event handlers
        this.setupSocketHandlers();
        
        // Start listening
        this.httpServer.listen(this.port, () => {
          console.log(`[BrowserSourceServer] HTTP server started on http://localhost:${this.port}`);
          console.log(`[BrowserSourceServer] Browser source URL: http://localhost:${this.port}/browser-source`);
          resolve();
        });
        
        this.httpServer.on('error', (error) => {
          console.error('[BrowserSourceServer] HTTP server error:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('[BrowserSourceServer] Failed to start server:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Stop HTTP and Socket.IO servers
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close();
        this.io = null;
      }
      
      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('[BrowserSourceServer] Server stopped');
          this.httpServer = null;
          resolve();
        });
      } else {
        resolve();
      }
      
      this.connectedClients.clear();
    });
  }
  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const fullUrl = req.url || '/';
    
    // Parse URL to remove query parameters
    const url = fullUrl.split('?')[0];
      // Route: /browser-source -> serve browser-source.html
    if (url === '/browser-source' || url === '/browser-source.html') {
      this.serveFile(res, 'browser-source.html', 'text/html');
    }
    // Route: /browser-source/tts -> serve browser-source-tts.html
    else if (url === '/browser-source/tts' || url === '/browser-source-tts.html') {
      this.serveFile(res, 'browser-source-tts.html', 'text/html');
    }
    // Route: /browser-source/entrance-sounds -> serve browser-source-entrance-sounds.html
    else if (url === '/browser-source/entrance-sounds' || url === '/browser-source-entrance-sounds.html') {
      this.serveFile(res, 'browser-source-entrance-sounds.html', 'text/html');
    }
    // Route: /browser-source.js -> serve browser-source.js
    else if (url === '/browser-source.js') {
      this.serveFile(res, 'browser-source.js', 'application/javascript');
    }
    // Route: /browser-source.css -> serve browser-source.css
    else if (url === '/browser-source.css') {
      this.serveFile(res, 'browser-source.css', 'text/css');
    }
    // Route: /media/* -> serve media files (audio, image, video)
    else if (url.startsWith('/media/')) {
      this.serveMediaFile(req, res, url);
    }
    // Route: /audio-file?path=... -> serve audio file by query parameter
    else if (url === '/audio-file') {
      this.serveAudioFileByQuery(req, res);
    }
    // Route: /health -> health check endpoint
    else if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        connectedClients: this.connectedClients.size,
        alertsSent: this.alertsSent,
        uptime: process.uptime()
      }));
    }
    // Route: / -> serve info page
    else if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stream Synth Browser Source Server</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #9147ff; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
            .info { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>🎬 Stream Synth Browser Source Server</h1>
          <div class="info">
            <p><strong>Status:</strong> Running</p>
            <p><strong>Port:</strong> ${this.port}</p>
            <p><strong>Connected Clients:</strong> ${this.connectedClients.size}</p>
            <p><strong>Alerts Sent:</strong> ${this.alertsSent}</p>
          </div>          <h2>📺 OBS Browser Source URL</h2>
          <p>Add this URL to your OBS browser source:</p>
          <p><code>http://localhost:${this.port}/browser-source</code></p>
          
          <h2>🎙️ TTS Browser Source URL</h2>
          <p>For Text-to-Speech overlay in OBS:</p>
          <p><code>http://localhost:${this.port}/browser-source/tts</code></p>
          
          <h2>🎉 Entrance Sounds Browser Source URL</h2>
          <p>For viewer entrance sounds in OBS:</p>
          <p><code>http://localhost:${this.port}/browser-source/entrance-sounds</code></p>
          
          <h2>🔗 Endpoints</h2>
          <ul>
            <li><code>/browser-source</code> - Browser source overlay page (alerts, event actions)</li>
            <li><code>/browser-source/tts</code> - TTS browser source page</li>
            <li><code>/browser-source/entrance-sounds</code> - Entrance sounds browser source page</li>
            <li><code>/health</code> - Health check endpoint</li>
          </ul>
        </body>
        </html>
      `);
    }
    // 404
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
  
  /**
   * Serve static file from public directory
   */
  private serveFile(res: http.ServerResponse, filename: string, contentType: string): void {
    const filePath = path.join(this.publicDir, filename);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`[BrowserSourceServer] Error reading file ${filename}:`, err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
        res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  /**
   * Serve media files from file system
   * URL format: /media/base64-encoded-path
   */
  private serveMediaFile(req: http.IncomingMessage, res: http.ServerResponse, url: string): void {
    try {
      // Extract base64-encoded file path from URL: /media/BASE64
      const encodedPath = url.substring('/media/'.length);
      
      if (!encodedPath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: No file path provided');
        return;
      }

      // Decode the base64 path
      let filePath: string;
      try {
        filePath = Buffer.from(decodeURIComponent(encodedPath), 'base64').toString('utf-8');
      } catch (error) {
        console.error('[BrowserSourceServer] Error decoding file path:', error);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: Invalid file path encoding');
        return;
      }

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[BrowserSourceServer] File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
        return;
      }

      // Get file extension for content type
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      // Map extensions to content types
      const contentTypeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.flac': 'audio/flac',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.flv': 'video/x-flv'
      };
      
      contentType = contentTypeMap[ext] || 'application/octet-stream';

      // Get file stats for proper headers
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`[BrowserSourceServer] Error getting file stats: ${filePath}`, err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }

        // Stream the file instead of loading it all into memory
        const fileStream = fs.createReadStream(filePath);
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          console.error(`[BrowserSourceServer] Error streaming file: ${filePath}`, error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
          }
          res.end('Internal Server Error');
        });
      });

    } catch (error) {
      console.error('[BrowserSourceServer] Error serving media file:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  /**
   * Serve audio file by query parameter
   * URL format: /audio-file?path=URL_ENCODED_PATH
   */
  private serveAudioFileByQuery(req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
      const url = new URL(req.url || '', `http://localhost:${this.port}`);
      const encodedPath = url.searchParams.get('path');
      
      if (!encodedPath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: No file path provided');
        return;
      }

      // Decode the file path
      const filePath = decodeURIComponent(encodedPath);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        console.error(`[BrowserSourceServer] Audio file not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
        return;
      }

      // Get file extension for content type
      const ext = path.extname(filePath).toLowerCase();
      
      // Map audio extensions to content types
      const audioContentTypes: Record<string, string> = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac'
      };
      
      const contentType = audioContentTypes[ext] || 'audio/mpeg';

      // Get file stats for proper headers
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`[BrowserSourceServer] Error getting file stats: ${filePath}`, err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*'
        });

        fileStream.pipe(res);

        fileStream.on('error', (error) => {
          console.error(`[BrowserSourceServer] Error streaming audio file: ${filePath}`, error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
          }
          res.end('Internal Server Error');
        });
      });

    } catch (error) {
      console.error('[BrowserSourceServer] Error serving audio file:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;
    
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      this.connectedClients.add(clientId);
      
      console.log(`[BrowserSourceServer] Client connected: ${clientId} (Total: ${this.connectedClients.size})`);
      
      // Send welcome message
      socket.emit('connected', {
        clientId,
        message: 'Connected to Stream Synth Browser Source Server',
        timestamp: new Date().toISOString()
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        this.connectedClients.delete(clientId);
        console.log(`[BrowserSourceServer] Client disconnected: ${clientId} (Total: ${this.connectedClients.size})`);
      });
        // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });
      
      // Handle test alert request
      socket.on('test-alert', () => {
        console.log(`[BrowserSourceServer] Test alert requested by ${clientId}`);
        this.sendTestAlert(socket);
      });
      
      // Handle alert broadcast (from test page or other clients)
      socket.on('alert', (payload: AlertPayload) => {
        console.log(`[BrowserSourceServer] Alert received from ${clientId}, broadcasting to all clients`);
        // Broadcast to ALL clients (including sender)
        this.io!.emit('alert', payload);
        this.alertsSent++;
      });      // Handle TTS finished notification from browser source
      socket.on('tts-finished', () => {
        console.log(`[BrowserSourceServer] TTS finished notification from ${clientId}`);
        if (this.ttsBridge) {
          this.ttsBridge.notifyFinished();
        }
      });
    });
  }
  
  /**
   * Set TTS bridge (for browser source TTS output)
   */
  public setTTSBridge(bridge: TTSBrowserSourceBridge): void {
    this.ttsBridge = bridge;
    console.log('[BrowserSourceServer] TTS bridge connected');
  }

  /**
   * Send alert to all connected browser sources
   */
  public sendAlert(payload: AlertPayload): void {
    if (!this.io) {
      console.warn('[BrowserSourceServer] Cannot send alert: Socket.IO server not started');
      return;
    }
    
    console.log(`[BrowserSourceServer] Broadcasting alert: ${payload.event_type} (Clients: ${this.connectedClients.size})`);
    
    // Broadcast to all connected clients
    this.io.emit('alert', payload);
    
    this.alertsSent++;
  }
    /**
   * Send test alert to specific client
   */
  private sendTestAlert(socket: any): void {
    const testPayload: AlertPayload = {
      event_type: 'channel.follow',
      channel_id: 'test-channel',
      channel: 'default',  // Browser source channel
      formatted: {
        html: '<strong>TestUser</strong> followed!',
        plainText: 'TestUser followed!',
        emoji: '❤️',
        variables: {
          username: 'TestUser',
          display_name: 'TestUser'
        }
      },
      text: {
        content: 'TestUser just followed! ❤️',
        duration: 5000,
        position: 'top-center',
        style: {
          fontSize: '32px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          backgroundColor: 'rgba(145, 71, 255, 0.9)',
          padding: '20px 40px',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }
      },
      timestamp: new Date().toISOString()
    };
    
    socket.emit('alert', testPayload);
    console.log('[BrowserSourceServer] Test alert sent');
  }
  
  /**
   * Get server stats
   */
  public getStats(): {
    isRunning: boolean;
    port: number;
    connectedClients: number;
    alertsSent: number;
    url: string;
  } {
    return {
      isRunning: this.httpServer !== null && this.io !== null,
      port: this.port,
      connectedClients: this.connectedClients.size,
      alertsSent: this.alertsSent,
      url: `http://localhost:${this.port}/browser-source`
    };
  }
  
  /**
   * Get connected client IDs
   */
  public getConnectedClients(): string[] {
    return Array.from(this.connectedClients);
  }
  
  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.httpServer !== null && this.io !== null;
  }
}

// Singleton instance
let instance: BrowserSourceServer | null = null;

/**
 * Get singleton instance
 */
export function getBrowserSourceServer(port?: number): BrowserSourceServer {
  if (!instance) {
    instance = new BrowserSourceServer(port);
  }
  return instance;
}

/**
 * Start server (if not already running)
 */
export async function startBrowserSourceServer(port?: number): Promise<BrowserSourceServer> {
  const server = getBrowserSourceServer(port);
  if (!server.isRunning()) {
    await server.start();
  }
  return server;
}

/**
 * Stop server
 */
export async function stopBrowserSourceServer(): Promise<void> {
  if (instance) {
    await instance.stop();
  }
}
