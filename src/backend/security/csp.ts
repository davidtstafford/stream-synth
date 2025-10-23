import { BrowserWindow, session } from 'electron';

export function setupContentSecurityPolicy(mainWindow: BrowserWindow): void {
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only apply CSP to local files, not external pages like Twitch
    if (details.url.startsWith('file://')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' https://api.twitch.tv https://id.twitch.tv wss://eventsub.wss.twitch.tv wss://irc-ws.chat.twitch.tv; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
}
