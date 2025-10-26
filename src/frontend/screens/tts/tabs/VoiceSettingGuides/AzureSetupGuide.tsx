import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');
const { shell } = window.require('electron');

export type WizardStep = 
  | 'introduction'
  | 'create-account'
  | 'create-resource'
  | 'get-credentials'
  | 'enter-credentials'
  | 'test-connection'
  | 'success';

export interface WizardState {
  currentStep: WizardStep;
  apiKey: string;
  region: string;
  isLoading: boolean;
  error: string | null;
  testResult: {
    success: boolean;
    voiceCount?: number;
    previewVoices?: Array<{ name: string; gender: string }>;
  } | null;
}

export interface AzureSetupGuideProps {
  onClose: () => void;
  onComplete: (apiKey: string, region: string) => void;
}

const AZURE_REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
  { value: 'centralus', label: 'Central US' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'canadaeast', label: 'Canada East' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'ukwest', label: 'UK West' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'norwayeast', label: 'Norway East' },
  { value: 'switzerlandnorth', label: 'Switzerland North' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'australiasoutheast', label: 'Australia Southeast' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'japanwest', label: 'Japan West' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'koreasouth', label: 'Korea South' },
  { value: 'southafricanorth', label: 'South Africa North' },
  { value: 'southindia', label: 'South India' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'westindia', label: 'West India' },
  { value: 'uaenorth', label: 'UAE North' },
];

const STORAGE_KEY = 'azure-setup-guide-state';

export const AzureSetupGuide: React.FC<AzureSetupGuideProps> = ({ onClose, onComplete }) => {
  const [state, setState] = useState<WizardState>(() => {
    // Try to restore saved state
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Don't restore test-connection or success steps - always start fresh
        if (parsed.currentStep === 'test-connection' || parsed.currentStep === 'success') {
          parsed.currentStep = 'enter-credentials';
        }
        return {
          ...parsed,
          isLoading: false,
          error: null,
          testResult: null
        };
      } catch (e) {
        console.error('Failed to restore guide state:', e);
      }
    }

    return {
      currentStep: 'introduction',
      apiKey: '',
      region: 'eastus',
      isLoading: false,
      error: null,
      testResult: null
    };
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      currentStep: state.currentStep,
      apiKey: state.apiKey,
      region: state.region
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state.currentStep, state.apiKey, state.region]);

  // Clear saved state on unmount if successful
  useEffect(() => {
    return () => {
      if (state.currentStep === 'success') {
        localStorage.removeItem(STORAGE_KEY);
      }
    };
  }, [state.currentStep]);

  const openUrl = (url: string) => {
    shell.openExternal(url);
  };

  const handleNext = () => {
    const steps: WizardStep[] = [
      'introduction',
      'create-account',
      'create-resource',
      'get-credentials',
      'enter-credentials',
      'test-connection',
      'success'
    ];

    const currentIndex = steps.indexOf(state.currentStep);
    if (currentIndex < steps.length - 1) {
      setState(prev => ({ ...prev, currentStep: steps[currentIndex + 1], error: null }));
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = [
      'introduction',
      'create-account',
      'create-resource',
      'get-credentials',
      'enter-credentials',
      'test-connection',
      'success'
    ];

    const currentIndex = steps.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState(prev => ({ ...prev, currentStep: steps[currentIndex - 1], error: null }));
    }
  };

  const handleTestConnection = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null, testResult: null }));

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timed out after 30 seconds. Please check your internet connection and try again.')), 30000);
      });

      // Test Azure connection with timeout
      const result = await Promise.race([
        ipcRenderer.invoke('azure:test-connection', {
          apiKey: state.apiKey,
          region: state.region
        }),
        timeoutPromise
      ]) as any;

      if (result.success) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          testResult: {
            success: true,
            voiceCount: result.voiceCount,
            previewVoices: result.previewVoices
          }
        }));
        // Auto-advance to success step
        setTimeout(() => handleNext(), 1500);
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Connection test failed'
        }));
      }
    } catch (error: any) {
      console.error('[Azure Guide] Test connection error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to test connection'
      }));
    }
  };

  const handleComplete = () => {
    onComplete(state.apiKey, state.region);
    localStorage.removeItem(STORAGE_KEY);
    onClose();
  };

  const handleClose = () => {
    if (state.currentStep === 'success' || confirm('Are you sure you want to close the guide? Your progress will be saved.')) {
      onClose();
    }
  };

  const canGoBack = state.currentStep !== 'introduction' && state.currentStep !== 'test-connection' && state.currentStep !== 'success';
  const canGoNext = state.currentStep !== 'enter-credentials' && state.currentStep !== 'test-connection' && state.currentStep !== 'success';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>
              {state.currentStep === 'introduction' && '🎤 Welcome to Azure Neural Voices!'}
              {state.currentStep === 'create-account' && '📋 Step 1 of 6: Create Azure Account'}
              {state.currentStep === 'create-resource' && '📋 Step 2 of 6: Create Speech Resource'}
              {state.currentStep === 'get-credentials' && '📋 Step 3 of 6: Get Your API Key and Region'}
              {state.currentStep === 'enter-credentials' && '📋 Step 4 of 6: Enter Your Credentials'}
              {state.currentStep === 'test-connection' && '📋 Step 5 of 6: Testing Connection...'}
              {state.currentStep === 'success' && '🎉 Setup Complete!'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: '4px',
          backgroundColor: '#333',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: '#9147ff',
            transition: 'width 0.3s ease',
            width: (() => {
              const steps: WizardStep[] = [
                'introduction',
                'create-account',
                'create-resource',
                'get-credentials',
                'enter-credentials',
                'test-connection',
                'success'
              ];
              const index = steps.indexOf(state.currentStep);
              return `${((index + 1) / steps.length) * 100}%`;
            })()
          }} />
        </div>

        {/* Content */}
        <div style={{
          padding: '32px'
        }}>
          {/* ...existing step content... */}
          <StepContent
            currentStep={state.currentStep}
            state={state}
            setState={setState}
            openUrl={openUrl}
            azureRegions={AZURE_REGIONS}
            isLoading={state.isLoading}
          />

          {/* Error Message */}
          {state.error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#ff6b6b33',
              border: '1px solid #ff6b6b',
              borderRadius: '6px',
              color: '#ff6b6b',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {state.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            onClick={handleBack}
            disabled={!canGoBack}
            style={{
              padding: '10px 20px',
              backgroundColor: canGoBack ? '#444' : '#333',
              color: canGoBack ? '#fff' : '#888',
              border: 'none',
              borderRadius: '6px',
              cursor: canGoBack ? 'pointer' : 'not-allowed',
              opacity: canGoBack ? 1 : 0.5
            }}
          >
            ← Back
          </button>
          <div style={{ flex: 1 }} />
          {state.currentStep === 'enter-credentials' && (
            <button
              onClick={handleTestConnection}
              disabled={state.isLoading || !state.apiKey}
              style={{
                padding: '10px 24px',
                backgroundColor: state.isLoading || !state.apiKey ? '#555' : '#9147ff',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: state.isLoading || !state.apiKey ? 'not-allowed' : 'pointer',
                opacity: state.isLoading || !state.apiKey ? 0.5 : 1
              }}
            >
              {state.isLoading ? '⏳ Testing...' : '🧪 Test Connection'}
            </button>
          )}
          {state.currentStep === 'success' && (
            <button
              onClick={handleComplete}
              style={{
                padding: '10px 24px',
                backgroundColor: '#0fb784',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ✓ Complete Setup
            </button>
          )}
          {canGoNext && state.currentStep !== 'enter-credentials' && (
            <button
              onClick={handleNext}
              style={{
                padding: '10px 24px',
                backgroundColor: '#9147ff',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Step content component
const StepContent: React.FC<{
  currentStep: WizardStep;
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  openUrl: (url: string) => void;
  azureRegions: Array<{ value: string; label: string }>;
  isLoading: boolean;
}> = ({ currentStep, state, setState, openUrl, azureRegions, isLoading }) => {
  const { shell } = window.require('electron');

  switch (currentStep) {
    case 'introduction':
      return (
        <div>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '16px' }}>
            Azure Cognitive Services provides high-quality, neural text-to-speech voices. This guide will help you set up your Azure account and connect it to Stream Synth.
          </p>
          <div style={{ backgroundColor: '#333', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#9147ff' }}>What you'll need:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#bbb' }}>
              <li>A Microsoft Azure account (free tier available)</li>
              <li>5-10 minutes of your time</li>
              <li>Your Azure API key and region</li>
            </ul>
          </div>
          <p style={{ color: '#999', fontSize: '14px' }}>
            ℹ️ The free tier includes 500,000 characters per month, which is plenty for most streaming use cases.
          </p>
        </div>
      );

    case 'create-account':
      return (
        <div>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '20px' }}>
            First, create a free Azure account (if you don't already have one).
          </p>
          <div style={{ backgroundColor: '#333', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0fb784' }}>Steps:</h3>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#bbb', lineHeight: '1.8' }}>
              <li>Visit <code style={{ backgroundColor: '#222', padding: '2px 6px', borderRadius: '3px' }}>portal.azure.com</code></li>
              <li>Click "Create a resource"</li>
              <li>Search for "Speech"</li>
              <li>Click the Speech service and then "Create"</li>
            </ol>
          </div>
          <button
            onClick={() => openUrl('https://portal.azure.com')}
            style={{
              padding: '10px 16px',
              backgroundColor: '#0078d4',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            → Open Azure Portal
          </button>
        </div>
      );

    case 'create-resource':
      return (
        <div>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '20px' }}>
            Create a new Speech resource in Azure.
          </p>
          <div style={{ backgroundColor: '#333', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0fb784' }}>Configuration:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#bbb', lineHeight: '1.8' }}>
              <li><strong>Name:</strong> Something like "stream-synth-tts" or your stream name</li>
              <li><strong>Region:</strong> Choose one closest to you (e.g., East US, West Europe)</li>
              <li><strong>Pricing tier:</strong> "Free F0" (includes 500K characters/month)</li>
              <li><strong>Resource group:</strong> Create new or use existing</li>
            </ul>
          </div>
          <p style={{ color: '#999', fontSize: '14px' }}>
            ℹ️ Make sure you remember the region you choose - you'll need it later.
          </p>
        </div>
      );

    case 'get-credentials':
      return (
        <div>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '20px' }}>
            After creating the Speech resource, get your API key and region.
          </p>
          <div style={{ backgroundColor: '#333', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0fb784' }}>Steps:</h3>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#bbb', lineHeight: '1.8' }}>
              <li>Go to your Speech resource in Azure Portal</li>
              <li>Click "Keys and Endpoint" in the left menu</li>
              <li>Copy <strong>Key 1</strong> or <strong>Key 2</strong></li>
              <li>Note your <strong>Region</strong> (e.g., "eastus")</li>
            </ol>
          </div>
          <p style={{ color: '#999', fontSize: '14px' }}>
            ⚠️ Keep your API key secret - treat it like a password.
          </p>
        </div>
      );

    case 'enter-credentials':
      return (
        <div>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '20px' }}>
            Enter your Azure API key and region.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px', fontWeight: 'bold' }}>
              API Key
            </label>
            <input
              type="password"
              value={state.apiKey}
              onChange={(e) => setState(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Paste your Azure API key here..."
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ color: '#999', fontSize: '12px', margin: '8px 0 0 0' }}>
              You can show/hide the key by toggling the password field.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc', fontSize: '14px', fontWeight: 'bold' }}>
              Region
            </label>
            <select
              value={state.region}
              onChange={(e) => setState(prev => ({ ...prev, region: e.target.value }))}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              {azureRegions.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      );

    case 'test-connection':
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 20px',
              backgroundColor: '#9147ff',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              animation: 'spin 1s linear infinite'
            }}>
              ⏳
            </div>
            <p style={{ color: '#ddd', margin: 0 }}>Testing your connection...</p>
            <p style={{ color: '#999', fontSize: '14px', margin: '8px 0 0 0' }}>
              This usually takes a few seconds.
            </p>
          </div>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );

    case 'success':
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            backgroundColor: '#0fb784',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px'
          }}>
            ✓
          </div>
          <h3 style={{ color: '#0fb784', margin: '0 0 12px 0' }}>Connected Successfully!</h3>
          <p style={{ color: '#ddd', lineHeight: '1.6', marginBottom: '20px' }}>
            {state.testResult?.success && (
              <>
                Found <strong>{state.testResult.voiceCount}</strong> Azure voices ready to use!
                {state.testResult.previewVoices && state.testResult.previewVoices.length > 0 && (
                  <>
                    <br />
                    <br />
                    <strong>Sample voices:</strong>
                    <ul style={{ margin: '12px 0 0 0', paddingLeft: '20px', textAlign: 'left' }}>
                      {state.testResult.previewVoices.slice(0, 3).map((v, i) => (
                        <li key={i}>{v.name} ({v.gender})</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      );

    default:
      return null;
  }
};
