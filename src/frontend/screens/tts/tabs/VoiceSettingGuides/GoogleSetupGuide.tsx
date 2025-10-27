import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');
const { shell } = window.require('electron');

export type GoogleWizardStep = 
  | 'introduction'
  | 'create-project'
  | 'enable-api'
  | 'create-credentials'
  | 'get-api-key'
  | 'enter-api-key'
  | 'test-connection'
  | 'success';

export interface GoogleWizardState {
  currentStep: GoogleWizardStep;
  apiKey: string;
  isLoading: boolean;
  error: string | null;
  testResult: {
    success: boolean;
    voiceCount?: number;
    previewVoices?: Array<{ name: string; gender: string }>;
  } | null;
}

export interface GoogleSetupGuideProps {
  onClose: () => void;
  onComplete: (apiKey: string) => void;
}

export const GoogleSetupGuide: React.FC<GoogleSetupGuideProps> = ({ onClose, onComplete }) => {
  const [state, setState] = useState<GoogleWizardState>({
    currentStep: 'introduction',
    apiKey: '',
    isLoading: false,
    error: null,
    testResult: null
  });

  const handleApiKeyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({
      ...prev,
      apiKey: e.target.value,
      error: null
    }));
  };

  const handleTestConnection = async () => {
    if (!state.apiKey.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter an API key'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      console.log('[GoogleSetupGuide] Testing connection with API key...');
      const result = await ipcRenderer.invoke('google:test-connection', { apiKey: state.apiKey });
      console.log('[GoogleSetupGuide] Test result:', result);

      if (result.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          testResult: result,
          currentStep: 'test-connection'
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to connect to Google Cloud API'
        }));
      }
    } catch (error: any) {
      console.error('[GoogleSetupGuide] Error testing connection:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to test connection'
      }));
    }
  };

  const handleComplete = async () => {
    if (!state.apiKey.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter an API key'
      }));
      return;
    }

    try {
      console.log('[GoogleSetupGuide] Completing setup with API key');
      onComplete(state.apiKey);
    } catch (error: any) {
      console.error('[GoogleSetupGuide] Error completing setup:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to complete setup'
      }));
    }
  };

  const openExternalLink = (url: string) => {
    shell.openExternal(url);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: '#e0e0e0',
        border: '1px solid #444'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5em' }}>🔵 Google Cloud Text-to-Speech Setup</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '1.5em',
              cursor: 'pointer',
              color: '#888',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Introduction Step */}
        {state.currentStep === 'introduction' && (
          <IntroductionStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'create-project' }))}
          />
        )}

        {/* Create Project Step */}
        {state.currentStep === 'create-project' && (
          <CreateProjectStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'enable-api' }))}
            openExternalLink={openExternalLink}
          />
        )}

        {/* Enable API Step */}
        {state.currentStep === 'enable-api' && (
          <EnableAPIStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'create-credentials' }))}
            openExternalLink={openExternalLink}
          />
        )}

        {/* Create Credentials Step */}
        {state.currentStep === 'create-credentials' && (
          <CreateCredentialsStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'get-api-key' }))}
            openExternalLink={openExternalLink}
          />
        )}

        {/* Get API Key Step */}
        {state.currentStep === 'get-api-key' && (
          <GetAPIKeyStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'enter-api-key' }))}
          />
        )}

        {/* Enter API Key Step */}
        {state.currentStep === 'enter-api-key' && (
          <EnterAPIKeyStep
            apiKey={state.apiKey}
            onApiKeyChange={handleApiKeyInputChange}
            error={state.error}
            isLoading={state.isLoading}
            onTest={handleTestConnection}
          />
        )}

        {/* Test Connection Step */}
        {state.currentStep === 'test-connection' && state.testResult && (
          <TestConnectionStep
            testResult={state.testResult}
            onComplete={handleComplete}
          />
        )}

        {/* Success Step */}
        {state.currentStep === 'success' && (
          <SuccessStep
            onClose={onClose}
            voiceCount={state.testResult?.voiceCount}
          />
        )}

        {/* Error Message */}
        {state.error && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#8b0000',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '0.9em'
          }}>
            ❌ {state.error}
          </div>
        )}

        {/* Navigation Buttons */}
        {state.currentStep !== 'success' && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {state.currentStep !== 'introduction' && (
              <button
                onClick={() => {
                  const steps: GoogleWizardStep[] = ['introduction', 'create-project', 'enable-api', 'create-credentials', 'get-api-key', 'enter-api-key', 'test-connection'];
                  const currentIndex = steps.indexOf(state.currentStep);
                  if (currentIndex > 0) {
                    setState(prev => ({ ...prev, currentStep: steps[currentIndex - 1], error: null }));
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#555',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: '#555',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const IntroductionStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Welcome to Google Cloud Text-to-Speech</h3>
    <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
      Google Cloud Text-to-Speech provides over 400 high-quality neural voices in 100+ languages and variants.
    </p>    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em',
      lineHeight: '1.5'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📋 Requirements:</div>
      <ul style={{ margin: '0', paddingLeft: '20px' }}>
        <li>Google Cloud account (free to create)</li>
        <li>Valid payment method on file (for usage beyond free tier)</li>
        <li>API key with Text-to-Speech permission</li>
      </ul>
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em',
      lineHeight: '1.5'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>💰 Pricing:</div>
      <ul style={{ margin: '0', paddingLeft: '20px' }}>
        <li><strong>Free tier:</strong> 1M characters per month (always free)</li>
        <li><strong>Standard voices:</strong> $4.00 per 1M characters (after free tier)</li>
        <li><strong>Neural/WaveNet voices:</strong> $10.00 per 1M characters (after free tier)</li>
        <li>Pay-as-you-go pricing after free tier</li>
      </ul>
    </div>

    <button
      onClick={onNext}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Let's Get Started →
    </button>
  </div>
);

const CreateProjectStep: React.FC<{ onNext: () => void; openExternalLink: (url: string) => void }> = ({ onNext, openExternalLink }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Step 1: Create a Google Cloud Project</h3>
    
    <div style={{ marginBottom: '20px' }}>
      <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
        <li>Go to <a href="#" onClick={(e) => { e.preventDefault(); openExternalLink('https://console.cloud.google.com/'); }} style={{ color: '#4285f4', cursor: 'pointer' }}>Google Cloud Console</a></li>
        <li>Click the project dropdown at the top</li>
        <li>Click <strong>"NEW PROJECT"</strong></li>
        <li>Enter a project name (e.g., "Stream Synth TTS")</li>
        <li>Click <strong>"CREATE"</strong></li>
        <li>Wait for the project to be created (this may take a minute)</li>
      </ol>
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em'
    }}>
      <strong>💡 Tip:</strong> Once created, make sure to select your new project from the dropdown at the top.
    </div>

    <button
      onClick={onNext}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Next: Enable API →
    </button>
  </div>
);

const EnableAPIStep: React.FC<{ onNext: () => void; openExternalLink: (url: string) => void }> = ({ onNext, openExternalLink }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Step 2: Enable Cloud Text-to-Speech API</h3>
    
    <div style={{ marginBottom: '20px' }}>
      <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
        <li>In the Cloud Console, search for <strong>"Cloud Text-to-Speech"</strong> in the search bar</li>
        <li>Look for <strong>"Cloud Text-to-Speech API"</strong> (NOT "Cloud Speech-to-Text")</li>
        <li>Click on it to open the API details page</li>
        <li>Click the <strong>"ENABLE"</strong> button</li>
        <li>Wait for the API to be enabled (usually takes a few seconds)</li>
      </ol>
    </div>

    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em',
      color: '#333'
    }}>
      <strong>⚠️ Important:</strong> Make sure you select <strong>"Cloud Text-to-Speech API"</strong>, NOT "Cloud Speech-to-Text API". They are different services!
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em'
    }}>
      <strong>💡 Tip:</strong> You may need to set up billing first. Follow the prompts if prompted. Google Cloud offers a free trial with $300 credit.
    </div>

    <button
      onClick={onNext}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Next: Create Credentials →
    </button>
  </div>
);

const CreateCredentialsStep: React.FC<{ onNext: () => void; openExternalLink: (url: string) => void }> = ({ onNext, openExternalLink }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Step 3: Create Credentials</h3>
    
    <div style={{ marginBottom: '20px' }}>
      <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
        <li>In the Cloud Console, go to <strong>"Credentials"</strong> (left sidebar)</li>
        <li>Click <strong>"+ CREATE CREDENTIALS"</strong></li>
        <li>Select <strong>"API Key"</strong></li>
        <li>A new API key will be created and displayed in a dialog</li>
        <li>Click <strong>"COPY"</strong> to copy the key</li>
        <li>Click <strong>"CLOSE"</strong></li>
      </ol>
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em'
    }}>
      <strong>🔒 Security:</strong> Your API key is sensitive. Keep it private and never share it publicly.
    </div>

    <button
      onClick={onNext}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Next: Get Your API Key →
    </button>
  </div>
);

const GetAPIKeyStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Step 4: Your API Key</h3>
    
    <p style={{ lineHeight: '1.6', marginBottom: '15px' }}>
      You should now have your API key copied to your clipboard. It looks something like:
    </p>

    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #444',
      borderRadius: '4px',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '0.85em',
      color: '#4285f4',
      marginBottom: '20px',
      wordBreak: 'break-all'
    }}>
      AIzaSyD1234567890abcdefghij-KlMnOpQr
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '20px',
      fontSize: '0.9em'
    }}>
      <strong>✓ Ready:</strong> If you've copied your API key, you're ready to proceed to the next step!
    </div>

    <button
      onClick={onNext}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Next: Enter Your API Key →
    </button>
  </div>
);

const EnterAPIKeyStep: React.FC<{
  apiKey: string;
  onApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  isLoading: boolean;
  onTest: () => void;
}> = ({ apiKey, onApiKeyChange, error, isLoading, onTest }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>Step 5: Enter Your API Key</h3>
    
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Google Cloud API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={onApiKeyChange}
        placeholder="Paste your API key here..."
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#e0e0e0',
          fontSize: '0.95em',
          boxSizing: 'border-box'
        }}
      />
    </div>

    <button
      onClick={onTest}
      disabled={!apiKey.trim() || isLoading}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: isLoading || !apiKey.trim() ? '#666' : '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: isLoading || !apiKey.trim() ? 'not-allowed' : 'pointer',
        fontWeight: 'bold',
        fontSize: '1em',
        opacity: isLoading || !apiKey.trim() ? 0.6 : 1
      }}
    >
      {isLoading ? '⏳ Testing Connection...' : '✓ Test & Continue'}
    </button>

    {error && (
      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#8b0000',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '0.9em'
      }}>
        ❌ {error}
      </div>
    )}
  </div>
);

const TestConnectionStep: React.FC<{
  testResult: { success: boolean; voiceCount?: number; previewVoices?: Array<{ name: string; gender: string }> };
  onComplete: () => void;
}> = ({ testResult, onComplete }) => (
  <div>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>✓ Connection Successful!</h3>
    
    {testResult.voiceCount && (
      <div style={{
        backgroundColor: '#1f3a5f',
        border: '1px solid #4285f4',
        borderRadius: '4px',
        padding: '12px',
        marginBottom: '20px',
        fontSize: '0.95em',
        lineHeight: '1.6'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🎉 Setup Complete!</div>
        <div>Found <strong>{testResult.voiceCount}</strong> available Google voices</div>
        {testResult.previewVoices && testResult.previewVoices.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Sample voices:</div>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              {testResult.previewVoices.slice(0, 3).map((voice, idx) => (
                <li key={idx}>{voice.name} ({voice.gender})</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}

    <button
      onClick={onComplete}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Start Using Google Voices
    </button>
  </div>
);

const SuccessStep: React.FC<{ onClose: () => void; voiceCount?: number }> = ({ onClose, voiceCount }) => (
  <div style={{ textAlign: 'center' }}>
    <h3 style={{ color: '#4285f4', marginTop: 0 }}>🎉 All Set!</h3>
    
    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #4285f4',
      borderRadius: '4px',
      padding: '20px',
      marginBottom: '20px',
      fontSize: '0.95em',
      lineHeight: '1.8'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Your Google Cloud setup is complete!</div>
      {voiceCount && (
        <div>You now have access to <strong>{voiceCount}</strong> premium Google voices.</div>
      )}
      <div style={{ marginTop: '10px', color: '#aaa', fontSize: '0.9em' }}>
        Your API key has been securely saved and will be used for text-to-speech.
      </div>
    </div>

    <button
      onClick={onClose}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: '#4285f4',
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '1em'
      }}
    >
      Close
    </button>
  </div>
);
