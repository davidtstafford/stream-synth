import React, { useState, useEffect } from 'react';
import * as ttsService from '../../services/tts';

export const TTS: React.FC = () => {
  const [settings, setSettings] = useState<ttsService.TTSSettings | null>(null);
  const [voices, setVoices] = useState<ttsService.TTSVoice[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Hello! This is a test of the text to speech system.');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [loadedSettings, loadedProviders] = await Promise.all([
        ttsService.getSettings(),
        ttsService.getProviders()
      ]);
      
      setSettings(loadedSettings);
      setProviders(loadedProviders);
      
      // Load voices for current provider
      if (loadedSettings) {
        await loadVoices();
      }
    } catch (err: any) {
      setError(err.message);
      console.error('[TTS Screen] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async () => {
    try {
      const loadedVoices = await ttsService.getVoices();
      setVoices(loadedVoices);
    } catch (err: any) {
      setError(err.message);
      console.error('[TTS Screen] Error loading voices:', err);
    }
  };

  const handleProviderChange = async (provider: string) => {
    try {
      setLoading(true);
      await ttsService.saveSettings({ provider: provider as any });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (key: keyof ttsService.TTSSettings, value: any) => {
    try {
      await ttsService.saveSettings({ [key]: value });
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestVoice = async () => {
    if (!settings?.voiceId) {
      setError('Please select a voice first');
      return;
    }

    try {
      setIsSpeaking(true);
      setError(null);
      
      await ttsService.speak(testMessage, {
        volume: settings.volume,
        rate: settings.rate,
        pitch: settings.pitch
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Reset after a delay (speech might still be playing)
      setTimeout(() => setIsSpeaking(false), 1000);
    }
  };

  const handleStop = async () => {
    try {
      await ttsService.stop();
      setIsSpeaking(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !settings) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Text-to-Speech</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Text-to-Speech</h2>
        <p style={{ color: 'red' }}>{error || 'Failed to load TTS settings'}</p>
      </div>
    );
  }

  const selectedVoice = voices.find(v => v.id === settings.voiceId);

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Text-to-Speech</h2>
      
      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          {error}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleSettingChange('enabled', e.target.checked)}
          />
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Enable TTS</span>
        </label>
      </div>

      {/* Provider Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          TTS Provider
        </label>
        <select
          value={settings.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          style={{ 
            padding: '8px', 
            fontSize: '14px', 
            borderRadius: '4px', 
            border: '1px solid #ccc',
            minWidth: '200px'
          }}
        >
          {providers.map(provider => (
            <option key={provider} value={provider}>
              {provider === 'webspeech' && 'Web Speech API (Free)'}
              {provider === 'azure' && 'Azure TTS (5M/month)'}
              {provider === 'google' && 'Google Cloud TTS (1M/month)'}
            </option>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          {settings.provider === 'webspeech' && '✅ Uses your system\'s built-in voices. No API key needed.'}
          {settings.provider === 'azure' && '🔑 Requires Azure API key. 5 million characters per month free forever.'}
          {settings.provider === 'google' && '🔑 Requires Google Cloud API key. 1 million characters per month free forever.'}
        </p>
      </div>

      {/* Voice Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Voice ({voices.length} available)
        </label>
        <select
          value={settings.voiceId || ''}
          onChange={(e) => handleSettingChange('voiceId', e.target.value)}
          style={{ 
            padding: '8px', 
            fontSize: '14px', 
            borderRadius: '4px', 
            border: '1px solid #ccc',
            minWidth: '300px'
          }}
        >
          <option value="">Select a voice...</option>
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name} ({voice.languageName}) - {voice.gender}
            </option>
          ))}
        </select>
        {selectedVoice && (
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Language: {selectedVoice.languageName} | Gender: {selectedVoice.gender} | Provider: {selectedVoice.provider}
          </p>
        )}
      </div>

      {/* Volume Control */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Volume: {settings.volume}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.volume}
          onChange={(e) => handleSettingChange('volume', parseInt(e.target.value))}
          style={{ width: '300px' }}
        />
      </div>

      {/* Rate Control */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Speed: {settings.rate}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.rate}
          onChange={(e) => handleSettingChange('rate', parseFloat(e.target.value))}
          style={{ width: '300px' }}
        />
      </div>

      {/* Pitch Control */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Pitch: {settings.pitch}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.pitch}
          onChange={(e) => handleSettingChange('pitch', parseFloat(e.target.value))}
          style={{ width: '300px' }}
        />
      </div>

      {/* Test Message */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Test Message
        </label>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={3}
          style={{ 
            width: '100%', 
            padding: '8px', 
            fontSize: '14px', 
            borderRadius: '4px', 
            border: '1px solid #ccc',
            fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Test Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleTestVoice}
          disabled={!settings.voiceId || isSpeaking}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: settings.voiceId && !isSpeaking ? '#4CAF50' : '#ccc',
            color: 'white',
            cursor: settings.voiceId && !isSpeaking ? 'pointer' : 'not-allowed'
          }}
        >
          {isSpeaking ? '🔊 Speaking...' : '▶️ Test Voice'}
        </button>
        
        <button
          onClick={handleStop}
          disabled={!isSpeaking}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: isSpeaking ? '#f44336' : '#ccc',
            color: 'white',
            cursor: isSpeaking ? 'pointer' : 'not-allowed'
          }}
        >
          ⏹️ Stop
        </button>

        <button
          onClick={loadVoices}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: 'white',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          🔄 Refresh Voices
        </button>
      </div>
    </div>
  );
};
