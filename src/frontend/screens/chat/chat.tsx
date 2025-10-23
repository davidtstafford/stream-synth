import React, { useState, useEffect, useRef } from 'react';
import * as db from '../../services/database';

const { ipcRenderer } = window.require('electron');

interface ChatScreenProps {
  channelId?: string;
}

interface ChatMessage {
  id: number;
  username: string;
  displayName?: string;
  message: string;
  timestamp: string;
  color?: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [maxMessages, setMaxMessages] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load max messages setting
  useEffect(() => {
    const loadMaxMessagesSetting = async () => {
      const setting = await db.getSetting('chat_max_messages');
      if (setting) {
        setMaxMessages(parseInt(setting, 10));
      }
    };
    loadMaxMessagesSetting();
  }, []);

  // Load initial chat messages from database
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!channelId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await db.getChatEvents(channelId, maxMessages);
        
        if (result.success && result.events) {
          // Reverse to show oldest first
          const chatMessages: ChatMessage[] = result.events
            .reverse()
            .map(event => {
              const data = JSON.parse(event.event_data);
              return {
                id: event.id,
                username: event.viewer_username || data.chatter_user_login || 'Unknown',
                displayName: event.viewer_display_name || data.chatter_user_name,
                message: data.message?.text || '',
                timestamp: event.created_at,
                color: data.color
              };
            });
          
          setMessages(chatMessages);
        } else {
          setError(result.error || 'Failed to load chat history');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load chat history');
      } finally {
        setLoading(false);
      }
    };

    loadChatHistory();
  }, [channelId, maxMessages]);

  // Listen for new chat messages in real-time
  useEffect(() => {
    const handleNewEvent = (eventData: any) => {
      // Only handle chat messages
      if (eventData.event_type !== 'channel.chat.message') {
        return;
      }

      const data = typeof eventData.event_data === 'string' 
        ? JSON.parse(eventData.event_data) 
        : eventData.event_data;

      const newMessage: ChatMessage = {
        id: eventData.id || Date.now(),
        username: eventData.viewer_username || data.chatter_user_login || 'Unknown',
        displayName: eventData.viewer_display_name || data.chatter_user_name,
        message: data.message?.text || '',
        timestamp: eventData.created_at || new Date().toISOString(),
        color: data.color
      };

      setMessages(prev => {
        const updated = [...prev, newMessage];
        // Limit to max messages
        if (updated.length > maxMessages) {
          return updated.slice(updated.length - maxMessages);
        }
        return updated;
      });
    };

    ipcRenderer.on('event:stored', handleNewEvent);

    return () => {
      ipcRenderer.removeListener('event:stored', handleNewEvent);
    };
  }, [maxMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Detect if user has scrolled up
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const handleMaxMessagesChange = async (value: number) => {
    setMaxMessages(value);
    await db.setSetting('chat_max_messages', value.toString());
    
    // Trim messages if new limit is lower
    if (messages.length > value) {
      setMessages(messages.slice(messages.length - value));
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the chat display? (This will not delete messages from the database)')) {
      setMessages([]);
    }
  };

  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '15px' }}>
        <h2 style={{ margin: 0, marginBottom: '10px' }}>Chat</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label htmlFor="max-messages">Max Messages:</label>
            <select
              id="max-messages"
              value={maxMessages}
              onChange={(e) => handleMaxMessagesChange(parseInt(e.target.value, 10))}
              style={{
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #555',
                backgroundColor: '#333',
                color: 'white'
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Auto-scroll
            </label>
          </div>

          <button
            onClick={handleClearChat}
            style={{
              padding: '6px 12px',
              backgroundColor: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Display
          </button>

          <span style={{ color: '#888', fontSize: '0.9em' }}>
            {messages.length} / {maxMessages} messages
          </span>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ff4444',
          color: 'white',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Loading chat history...
        </div>
      )}

      {!loading && !channelId && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Please connect to a channel to view chat
        </div>
      )}

      {!loading && channelId && messages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No chat messages yet. Messages will appear here as they come in.
        </div>
      )}

      {!loading && messages.length > 0 && (
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#1e1e1e',
            borderRadius: '4px',
            padding: '15px',
            minHeight: '400px'
          }}
        >
          {messages.map((msg, index) => (
            <div
              key={`${msg.id}-${index}`}
              style={{
                marginBottom: '8px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: index % 2 === 0 ? '#2a2a2a' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ color: '#888', fontSize: '0.85em', minWidth: '70px' }}>
                  {formatTime(msg.timestamp)}
                </span>
                <span
                  style={{
                    color: msg.color || '#9147ff',
                    fontWeight: 'bold',
                    minWidth: '100px'
                  }}
                >
                  {msg.displayName || msg.username}:
                </span>
                <span style={{ color: '#fff', wordBreak: 'break-word', flex: 1 }}>
                  {msg.message}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {!autoScroll && messages.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px 20px',
            backgroundColor: '#9147ff',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            zIndex: 100
          }}
        >
          ↓ Jump to Bottom
        </button>
      )}
    </div>
  );
};
