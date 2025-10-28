import React from 'react';
import * as ttsService from '../../../services/tts';

interface Props {
  settings: ttsService.TTSSettings;
  onSettingChange: (key: keyof ttsService.TTSSettings, value: any) => Promise<void>;
}

export const TTSRulesTab: React.FC<Props> = ({ settings, onSettingChange }) => {
  return (
    <div className="rules-tab">
      <h3>📋 TTS Filtering & Rules</h3>
      <p className="section-description">
        Control which messages are read aloud and how they are processed.
      </p>

      {/* Message Filtering */}
      <div className="rules-section">
        <h4>🔍 Message Filtering</h4>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.filterCommands ?? true}
              onChange={(e) => onSettingChange('filterCommands', e.target.checked)}
            />
            <span className="checkbox-text">
              Filter Commands
              <span className="setting-hint">Skip messages starting with ! or ~ (e.g., !followage, ~setmyvoice)</span>
            </span>
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.filterBots ?? true}
              onChange={(e) => onSettingChange('filterBots', e.target.checked)}
            />
            <span className="checkbox-text">
              Filter Bot Messages
              <span className="setting-hint">Skip messages from Nightbot, StreamElements, Streamlabs, Moobot, Fossabot, Wizebot</span>
            </span>
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.filterUrls ?? true}
              onChange={(e) => onSettingChange('filterUrls', e.target.checked)}
            />
            <span className="checkbox-text">
              Remove URLs
              <span className="setting-hint">Strip http:// and https:// links from messages before speaking</span>
            </span>
          </label>
        </div>
      </div>

      {/* Username Announcement */}
      <div className="rules-section">
        <h4>👤 Username Announcement</h4>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.announceUsername ?? true}
              onChange={(e) => onSettingChange('announceUsername', e.target.checked)}
            />
            <span className="checkbox-text">
              Announce Username
              <span className="setting-hint">Say "Username says:" before each message. Disable to only read the message.</span>
            </span>
          </label>
        </div>

        <div className="example-box">
          <strong>Example:</strong>
          <div className="example-text">
            {settings.announceUsername ?? true
              ? '🔊 "ViewerName says: Hello everyone!"'
              : '🔊 "Hello everyone!"'}
          </div>
        </div>
      </div>

      {/* Message Length Limits */}
      <div className="rules-section">
        <h4>📏 Message Length Limits</h4>

        <div className="setting-group">
          <label className="setting-label">
            Minimum Length: {settings.minMessageLength ?? 0} characters
          </label>
          <input
            type="range"
            min="0"
            max="50"
            value={settings.minMessageLength ?? 0}
            onChange={(e) => onSettingChange('minMessageLength', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Skip messages shorter than this. Set to 0 to disable. Useful for filtering single-emoji spam.
          </p>
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Maximum Length: {settings.maxMessageLength ?? 500} characters
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={settings.maxMessageLength ?? 500}
            onChange={(e) => onSettingChange('maxMessageLength', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Truncate messages longer than this. Prevents excessive reading of copypastas.
          </p>
        </div>
      </div>

      {/* Duplicate Detection */}
      <div className="rules-section">
        <h4>🔁 Duplicate Message Detection</h4>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.skipDuplicateMessages ?? true}
              onChange={(e) => onSettingChange('skipDuplicateMessages', e.target.checked)}
            />
            <span className="checkbox-text">
              Skip Duplicate Messages
              <span className="setting-hint">Don't read the same message twice within the time window</span>
            </span>
          </label>
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Duplicate Window: {settings.duplicateMessageWindow ?? 300} seconds ({Math.floor((settings.duplicateMessageWindow ?? 300) / 60)} minutes)
          </label>
          <input
            type="range"
            min="60"
            max="600"
            step="30"
            value={settings.duplicateMessageWindow ?? 300}
            onChange={(e) => onSettingChange('duplicateMessageWindow', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            How long to remember messages. Same message can only be read once per window.
          </p>
        </div>
      </div>

      {/* Rate Limiting & Cooldowns */}
      <div className="rules-section">
        <h4>⏱️ Rate Limiting & Cooldowns</h4>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.userCooldownEnabled ?? true}
              onChange={(e) => onSettingChange('userCooldownEnabled', e.target.checked)}
            />
            <span className="checkbox-text">
              Per-User Cooldown
              <span className="setting-hint">Limit how often each user can trigger TTS</span>
            </span>
          </label>
        </div>

        {settings.userCooldownEnabled && (
          <div className="setting-group" style={{ marginLeft: '28px' }}>
            <label className="setting-label">
              User Cooldown: {settings.userCooldownSeconds ?? 30} seconds
            </label>
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={settings.userCooldownSeconds ?? 30}
              onChange={(e) => onSettingChange('userCooldownSeconds', parseInt(e.target.value))}
              className="slider"
            />
          </div>
        )}

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.globalCooldownEnabled ?? false}
              onChange={(e) => onSettingChange('globalCooldownEnabled', e.target.checked)}
            />
            <span className="checkbox-text">
              Global Cooldown
              <span className="setting-hint">Limit TTS frequency across all users (prevents spam during raids)</span>
            </span>
          </label>
        </div>

        {settings.globalCooldownEnabled && (
          <div className="setting-group" style={{ marginLeft: '28px' }}>
            <label className="setting-label">
              Global Cooldown: {settings.globalCooldownSeconds ?? 5} seconds
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={settings.globalCooldownSeconds ?? 5}
              onChange={(e) => onSettingChange('globalCooldownSeconds', parseInt(e.target.value))}
              className="slider"
            />
          </div>
        )}

        <div className="setting-group">
          <label className="setting-label">
            Max Queue Size: {settings.maxQueueSize ?? 20} messages
          </label>
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={settings.maxQueueSize ?? 20}
            onChange={(e) => onSettingChange('maxQueueSize', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Maximum messages in queue. New messages dropped if queue is full.
          </p>
        </div>
      </div>

      {/* Emote & Emoji Limits */}
      <div className="rules-section">
        <h4>😀 Emote & Emoji Limits</h4>

        <div className="setting-group">
          <label className="setting-label">
            Max Emotes per Message: {settings.maxEmotesPerMessage ?? 5}
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={settings.maxEmotesPerMessage ?? 5}
            onChange={(e) => onSettingChange('maxEmotesPerMessage', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Limit Twitch emotes per message. Set to 0 for no limit.
          </p>
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Max Emojis per Message: {settings.maxEmojisPerMessage ?? 3}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={settings.maxEmojisPerMessage ?? 3}
            onChange={(e) => onSettingChange('maxEmojisPerMessage', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            Limit Unicode emojis per message. Set to 0 for no limit.
          </p>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.stripExcessiveEmotes ?? true}
              onChange={(e) => onSettingChange('stripExcessiveEmotes', e.target.checked)}
            />
            <span className="checkbox-text">
              Strip Excessive Emotes
              <span className="setting-hint">Remove excess emotes instead of skipping the entire message</span>
            </span>
          </label>
        </div>
      </div>

      {/* Character Repetition */}
      <div className="rules-section">
        <h4>🔤 Character & Word Repetition</h4>

        <div className="setting-group">
          <label className="setting-label">
            Max Repeated Characters: {settings.maxRepeatedChars ?? 3}
          </label>
          <input
            type="range"
            min="2"
            max="10"
            value={settings.maxRepeatedChars ?? 3}
            onChange={(e) => onSettingChange('maxRepeatedChars', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            "woooooow" → "wooow", "lolllll" → "lolll" (limits consecutive chars to {settings.maxRepeatedChars ?? 3})
          </p>
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Max Repeated Words: {settings.maxRepeatedWords ?? 2}
          </label>
          <input
            type="range"
            min="1"
            max="5"
            value={settings.maxRepeatedWords ?? 2}
            onChange={(e) => onSettingChange('maxRepeatedWords', parseInt(e.target.value))}
            className="slider"
          />
          <p className="setting-hint">
            "really really really really" → "really really"
          </p>
        </div>
      </div>      {/* Content Filters */}
      <div className="rules-section">
        <h4>🛡️ Content Filters</h4>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.copypastaFilterEnabled ?? false}
              onChange={(e) => onSettingChange('copypastaFilterEnabled', e.target.checked)}
            />
            <span className="checkbox-text">
              Block Known Copypastas
              <span className="setting-hint">Skip common copypasta spam (basic list included)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Blocked Words */}
      <div className="rules-section">
        <h4>🚫 Blocked Words</h4>
        <p className="section-description">
          Add words or phrases that should not be read aloud by TTS. They will be silently removed from messages.
        </p>

        <BlockedWordsEditor settings={settings} onSettingChange={onSettingChange} />
      </div>

      {/* Future Features */}
      <div className="rules-section">
        <h4>✨ Coming Soon</h4>
        <ul className="feature-list">
          <li>Per-viewer voice assignments</li>
          <li>Chat command: <code>~setmyvoice [voice_id]</code></li>
          <li>Muted viewers list</li>
          <li>Account age requirements</li>
          <li>Watch time requirements</li>
          <li>Role-based voice rules (subscribers, mods, VIPs)</li>
          <li>Priority queue for specific users</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Component for managing blocked words
 */
interface BlockedWordsEditorProps {
  settings: ttsService.TTSSettings;
  onSettingChange: (key: keyof ttsService.TTSSettings, value: any) => Promise<void>;
}

const BlockedWordsEditor: React.FC<BlockedWordsEditorProps> = ({ settings, onSettingChange }) => {
  const [inputValue, setInputValue] = React.useState('');
  const [error, setError] = React.useState('');

  const blockedWords = settings.blockedWords ?? [];

  const handleAddWord = async () => {
    const word = inputValue.trim().toLowerCase();
    
    if (!word) {
      setError('Please enter a word');
      return;
    }

    if (blockedWords.includes(word)) {
      setError('Word already in list');
      return;
    }

    if (word.length > 50) {
      setError('Word too long (max 50 characters)');
      return;
    }

    const newList = [...blockedWords, word].sort();
    await onSettingChange('blockedWords', newList);
    setInputValue('');
    setError('');
  };

  const handleRemoveWord = async (word: string) => {
    const newList = blockedWords.filter(w => w !== word);
    await onSettingChange('blockedWords', newList);
  };

  return (
    <div className="blocked-words-editor">
      <div className="setting-group">
        <label className="setting-label">Add Blocked Word:</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Enter word to block..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddWord();
              }
            }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #555',
              backgroundColor: '#333',
              color: 'white',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleAddWord}
            style={{
              padding: '8px 16px',
              backgroundColor: '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Add
          </button>
        </div>
        {error && <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>{error}</p>}
      </div>

      {blockedWords.length > 0 && (
        <div className="setting-group">
          <label className="setting-label">Blocked Words ({blockedWords.length}):</label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px',
            backgroundColor: '#2a2a2a',
            borderRadius: '4px',
            border: '1px solid #555'
          }}>
            {blockedWords.map((word) => (
              <div
                key={word}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}
              >
                <span>{word}</span>
                <button
                  onClick={() => handleRemoveWord(word)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '14px',
                    lineHeight: '1'
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="setting-hint">
            {blockedWords.length} word(s) will be silently removed from messages before TTS processing.
          </p>
        </div>
      )}
    </div>
  );
};
