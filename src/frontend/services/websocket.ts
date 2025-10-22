const WebSocket = window.require('ws');

export interface WebSocketHandlers {
  onSessionWelcome?: (sessionId: string) => void;
  onKeepalive?: () => void;
  onNotification?: (data: any) => void;
  onReconnect?: () => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function createWebSocketConnection(handlers: WebSocketHandlers): any {
  const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  ws.on('open', () => {
    console.log('WebSocket connection opened');
  });

  ws.on('message', (data: any) => {
    const message = JSON.parse(data.toString());
    console.log('WebSocket message:', message);
    
    const messageType = message.metadata?.message_type;
    
    if (messageType === 'session_welcome') {
      const sessionIdValue = message.payload?.session?.id;
      if (handlers.onSessionWelcome) {
        handlers.onSessionWelcome(sessionIdValue);
      }
    } else if (messageType === 'session_keepalive') {
      console.log('Received keepalive message');
      if (handlers.onKeepalive) {
        handlers.onKeepalive();
      }
    } else if (messageType === 'notification') {
      console.log('Received event notification:', message);
      if (handlers.onNotification) {
        handlers.onNotification(message);
      }
    } else if (messageType === 'session_reconnect') {
      console.log('Received reconnect request');
      if (handlers.onReconnect) {
        handlers.onReconnect();
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
    if (handlers.onError) {
      handlers.onError(error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (handlers.onClose) {
      handlers.onClose();
    }
  });

  return ws;
}
