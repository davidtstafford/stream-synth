import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface TTSAccessConfig {
  id: number;
  access_mode: 'access_all' | 'limited_access' | 'premium_voice_access';
  
  // Limited Access
  limited_allow_subscribers: number;
  limited_deny_gifted_subs: number;
  limited_allow_vip: number;
  limited_allow_mod: number;
  limited_redeem_name: string | null;
  limited_redeem_duration_mins: number | null;
  
  // Premium Voice Access
  premium_allow_subscribers: number;
  premium_deny_gifted_subs: number;
  premium_allow_vip: number;
  premium_allow_mod: number;
  premium_redeem_name: string | null;
  premium_redeem_duration_mins: number | null;
}

interface Message {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

interface Props {
  globalVoiceProvider: string; // 'webspeech' | 'azure' | 'google'
}

export const TTSAccessTab: React.FC<Props> = ({ globalVoiceProvider }) => {
  const [config, setConfig] = useState<TTSAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Auto-save when config changes (debounced)
    if (config && !loading) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      const timeout = setTimeout(() => {
        saveConfig(config);
      }, 500); // 500ms debounce
      
      setSaveTimeout(timeout);
    }
  }, [config]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await ipcRenderer.invoke('tts-access:get-config');
      
      if (response.success && response.data) {
        setConfig(response.data);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to load configuration' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };
  const updateConfig = (field: keyof TTSAccessConfig, value: any) => {
    if (!config) return;
    
    setConfig({
      ...config,
      [field]: value
    });
  };

  const saveConfig = async (configToSave: TTSAccessConfig) => {
    try {
      setSaving(true);
      const response = await ipcRenderer.invoke('tts-access:save-config', configToSave);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Saved' });
        // Clear message after 2 seconds
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to save' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };
  const handleModeChange = (newMode: 'access_all' | 'limited_access' | 'premium_voice_access') => {
    if (!config) return;

    // Validate premium mode
    if (newMode === 'premium_voice_access' && globalVoiceProvider !== 'webspeech') {
      setMessage({
        type: 'warning',
        text: 'Cannot enable Premium Voice Access while global voice is set to Azure or Google. Please set global voice to WebSpeech first.'
      });
      return;
    }

    // Clear message when switching modes
    setMessage(null);
    
    setConfig({
      ...config,
      access_mode: newMode
    });
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to default settings?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await ipcRenderer.invoke('tts-access:reset-config');
      
      if (response.success) {
        await loadConfig();
        setMessage({ type: 'success', text: 'Configuration reset to defaults' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to reset configuration' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading TTS access configuration...</div>;
  }

  if (!config) {
    return <div className="error">Failed to load configuration</div>;
  }
  const canEnablePremiumMode = globalVoiceProvider === 'webspeech';

  return (
    <div className="tts-access-tab">
      <div className="tab-header">
        <h2>TTS Access Control</h2>
        <p className="tab-description">
          Control who can use TTS and premium voices (Azure/Google) based on subscription status, VIP status, and channel point redeems.
        </p>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Warning: Premium Voice Access mode with Azure/Google global voice */}
      {config && config.access_mode === 'premium_voice_access' && globalVoiceProvider !== 'webspeech' && (
        <div className="warning-box">
          <strong>⚠️ Configuration Warning:</strong> 
          Premium Voice Access mode should only be used when the global voice is set to WebSpeech.
          Your current global voice is set to {globalVoiceProvider === 'azure' ? 'Azure' : 'Google'}. 
          Non-eligible viewers will have no voice to fall back to.
          <br/><br/>
          <strong>Recommendation:</strong> Change the global voice to WebSpeech in the Voice Settings tab, or switch to "Access to All" mode.
        </div>
      )}

      <div className="config-section">
        <label className="config-label">Apply TTS Restrictions:</label>
        <select 
          value={config.access_mode} 
          onChange={(e) => handleModeChange(e.target.value as any)}
          className="mode-selector"
        >
          <option value="access_all">Access to All</option>
          <option value="limited_access">Limited Access</option>
          <option value="premium_voice_access">Premium Voice Access</option>
        </select>
        
        <div className="mode-description">
          {config.access_mode === 'access_all' && (
            <p>Everyone can use TTS with any voice (no restrictions).</p>
          )}
          {config.access_mode === 'limited_access' && (
            <p>Only specific viewers can use TTS at all (blocks completely for non-eligible viewers).</p>
          )}
          {config.access_mode === 'premium_voice_access' && (
            <p>Everyone can use TTS, but only specific viewers can use premium voices (Azure/Google).</p>
          )}
        </div>
      </div>

      {/* Limited Access Rules */}
      {config.access_mode === 'limited_access' && (
        <div className="access-rules">
          <h3>Limited Access Rules</h3>
          <p className="rules-info">Configure who can use TTS:</p>
          
          <div className="rule-item">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={true} 
                disabled 
              />
              <span className="checkbox-text">
                Allow Subscribers <em>(required)</em>
              </span>
            </label>
          </div>
          
          <div className="rule-item sub-rule">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={config.limited_deny_gifted_subs === 1}
                onChange={(e) => updateConfig('limited_deny_gifted_subs', e.target.checked ? 1 : 0)}
              />
              <span className="checkbox-text">Deny Gifted Subscribers</span>
            </label>
            <p className="rule-description">If checked, viewers with gifted subscriptions cannot use TTS.</p>
          </div>
            <div className="rule-item">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={config.limited_allow_vip === 1}
                onChange={(e) => updateConfig('limited_allow_vip', e.target.checked ? 1 : 0)}
              />
              <span className="checkbox-text">Allow VIP</span>
            </label>
            <p className="rule-description">VIP viewers can use TTS even if not subscribed.</p>
          </div>
          
          <div className="rule-item">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={config.limited_allow_mod === 1}
                onChange={(e) => updateConfig('limited_allow_mod', e.target.checked ? 1 : 0)}
              />
              <span className="checkbox-text">Allow Mod</span>
            </label>
            <p className="rule-description">Moderators can use TTS even if not subscribed.</p>
          </div>
          
          <div className="rule-item redeem-rule">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={!!config.limited_redeem_name}
                onChange={(e) => {
                  if (!e.target.checked) {
                    updateConfig('limited_redeem_name', null);
                    updateConfig('limited_redeem_duration_mins', null);
                  } else {
                    updateConfig('limited_redeem_name', '');
                    updateConfig('limited_redeem_duration_mins', 60);
                  }
                }}
              />
              <span className="checkbox-text">Channel Point Redeem Access</span>
            </label>
            
            {config.limited_redeem_name !== null && (
              <div className="redeem-config">
                <label>If redeem named</label>
                <input 
                  type="text" 
                  placeholder="Redeem name"
                  value={config.limited_redeem_name || ''}
                  onChange={(e) => updateConfig('limited_redeem_name', e.target.value)}
                  className="text-input"
                />
                <label>is activated, grant</label>
                <input 
                  type="number" 
                  min="1"
                  value={config.limited_redeem_duration_mins || 0}
                  onChange={(e) => updateConfig('limited_redeem_duration_mins', parseInt(e.target.value) || null)}
                  className="number-input"
                />
                <label>minutes of TTS access</label>
              </div>            )}
            <p className="rule-description">
              Viewers can redeem channel points to get temporary TTS access.
              <br/><em>Note: Requires EventSub event "channel.channel_points_custom_reward_redemption.add" (automatically enabled).</em>
            </p>
          </div>
        </div>
      )}      {/* Premium Voice Access Rules */}
      {config.access_mode === 'premium_voice_access' && (
        <div className="access-rules">
            <h3>Premium Voice Access Rules</h3>
            <p className="rules-info">Configure who can use premium voices (Azure/Google):</p>
            
            <div className="rule-item">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={true} 
                  disabled 
                />
                <span className="checkbox-text">
                  Allow Subscribers <em>(required)</em>
                </span>
              </label>
            </div>
            
            <div className="rule-item sub-rule">
              <label className="checkbox-label">
                <input 
                  type="checkbox"
                  checked={config.premium_deny_gifted_subs === 1}
                  onChange={(e) => updateConfig('premium_deny_gifted_subs', e.target.checked ? 1 : 0)}
                />
                <span className="checkbox-text">Deny Gifted Subscribers</span>
              </label>
              <p className="rule-description">If checked, viewers with gifted subscriptions cannot use premium voices.</p>
            </div>
              <div className="rule-item">
              <label className="checkbox-label">
                <input 
                  type="checkbox"
                  checked={config.premium_allow_vip === 1}
                  onChange={(e) => updateConfig('premium_allow_vip', e.target.checked ? 1 : 0)}
                />
                <span className="checkbox-text">Allow VIP</span>
              </label>
              <p className="rule-description">VIP viewers can use premium voices even if not subscribed.</p>
            </div>
            
            <div className="rule-item">
              <label className="checkbox-label">
                <input 
                  type="checkbox"
                  checked={config.premium_allow_mod === 1}
                  onChange={(e) => updateConfig('premium_allow_mod', e.target.checked ? 1 : 0)}
                />
                <span className="checkbox-text">Allow Mod</span>
              </label>
              <p className="rule-description">Moderators can use premium voices even if not subscribed.</p>
            </div>
            
            <div className="rule-item redeem-rule">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={!!config.premium_redeem_name}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      updateConfig('premium_redeem_name', null);
                      updateConfig('premium_redeem_duration_mins', null);
                    } else {
                      updateConfig('premium_redeem_name', '');
                      updateConfig('premium_redeem_duration_mins', 60);
                    }
                  }}
                />
                <span className="checkbox-text">Channel Point Redeem Access</span>
              </label>
              
              {config.premium_redeem_name !== null && (
                <div className="redeem-config">
                  <label>If redeem named</label>
                  <input 
                    type="text" 
                    placeholder="Redeem name"
                    value={config.premium_redeem_name || ''}
                    onChange={(e) => updateConfig('premium_redeem_name', e.target.value)}
                    className="text-input"
                  />
                  <label>is activated, grant</label>
                  <input 
                    type="number" 
                    min="1"
                    value={config.premium_redeem_duration_mins || 0}
                    onChange={(e) => updateConfig('premium_redeem_duration_mins', parseInt(e.target.value) || null)}
                    className="number-input"
                  />                  <label>minutes of premium voice access</label>
                </div>              )}              <p className="rule-description">
                Viewers can redeem channel points to get temporary premium voice access.
                <br/><em>Note: Requires EventSub event "channel.channel_points_custom_reward_redemption.add" (automatically enabled).</em>
              </p>
            </div>          </div>
      )}

      {saving && (
        <div className="saving-indicator">
          <em>Saving...</em>
        </div>
      )}
    </div>
  );
};
