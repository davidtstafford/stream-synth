import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');
const { shell } = window.require('electron');

type WizardStep = 
  | 'introduction'
  | 'create-account'
  | 'create-resource'
  | 'get-credentials'
  | 'enter-credentials'
  | 'test-connection'
  | 'success';

interface WizardState {
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

interface AzureSetupWizardProps {
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

const STORAGE_KEY = 'azure-setup-wizard-state';

export const AzureSetupWizard: React.FC<AzureSetupWizardProps> = ({ onClose, onComplete }) => {
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
        console.error('Failed to restore wizard state:', e);
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
      console.error('[Azure Wizard] Test connection error:', error);
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
    if (state.currentStep === 'success' || confirm('Are you sure you want to close the wizard? Your progress will be saved.')) {
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
        <div style={{ padding: '32px' }}>
          {state.currentStep === 'introduction' && (
            <IntroductionStep onNext={handleNext} onClose={handleClose} />
          )}
          {state.currentStep === 'create-account' && (
            <CreateAccountStep onNext={handleNext} onBack={handleBack} openUrl={openUrl} />
          )}
          {state.currentStep === 'create-resource' && (
            <CreateResourceStep onNext={handleNext} onBack={handleBack} openUrl={openUrl} />
          )}
          {state.currentStep === 'get-credentials' && (
            <GetCredentialsStep onNext={handleNext} onBack={handleBack} openUrl={openUrl} />
          )}
          {state.currentStep === 'enter-credentials' && (
            <EnterCredentialsStep
              apiKey={state.apiKey}
              region={state.region}
              onApiKeyChange={(value) => setState(prev => ({ ...prev, apiKey: value }))}
              onRegionChange={(value) => setState(prev => ({ ...prev, region: value }))}
              onBack={handleBack}
              onTest={handleTestConnection}
              regions={AZURE_REGIONS}
            />
          )}
          {state.currentStep === 'test-connection' && (
            <TestConnectionStep
              isLoading={state.isLoading}
              error={state.error}
              testResult={state.testResult}
              onBack={handleBack}
              onRetry={handleTestConnection}
              onNext={handleNext}
            />
          )}
          {state.currentStep === 'success' && (
            <SuccessStep
              voiceCount={state.testResult?.voiceCount || 400}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Step Components

const IntroductionStep: React.FC<{ onNext: () => void; onClose: () => void }> = ({ onNext, onClose }) => (
  <div>
    <div style={{ fontSize: '16px', lineHeight: '1.6', color: '#ccc', marginBottom: '24px' }}>
      <p>
        Azure Neural Voices provide premium, natural-sounding text-to-speech
        with over 400 voices in 53 languages.
      </p>
    </div>

    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>✨ Benefits:</h3>
      <ul style={{ color: '#ccc', lineHeight: '1.8' }}>
        <li>Ultra-realistic voices with emotion and expression</li>
        <li>Wide language support (53 languages)</li>
        <li><strong>500,000 characters FREE per month</strong></li>
        <li>Perfect for professional streams</li>
      </ul>
    </div>

    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>💰 Cost:</h3>
      <ul style={{ color: '#ccc', lineHeight: '1.8' }}>
        <li><strong>FREE TIER:</strong> 500k characters/month (plenty for most streamers!)</li>
        <li><strong>After free tier:</strong> $1 per 1 million characters</li>
        <li><strong>Typical usage:</strong> ~150k chars/month = <span style={{ color: '#4CAF50' }}>FREE!</span></li>
      </ul>
    </div>

    <div style={{ marginBottom: '32px' }}>
      <p style={{ color: '#ccc', fontSize: '16px' }}>
        <strong>⏱️ Setup Time:</strong> 5-10 minutes
      </p>
    </div>

    <div style={{ 
      backgroundColor: '#2a2a2a', 
      padding: '16px', 
      borderRadius: '8px',
      marginBottom: '32px',
      borderLeft: '4px solid #9147ff'
    }}>
      <p style={{ color: '#fff', margin: 0, fontWeight: 'bold', marginBottom: '8px' }}>
        This wizard will guide you through:
      </p>
      <ol style={{ color: '#ccc', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
        <li>Creating a FREE Azure account (no credit card for free tier!)</li>
        <li>Creating a Speech resource</li>
        <li>Getting your API key and region</li>
        <li>Testing your connection</li>
      </ol>
    </div>

    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
      <button
        onClick={onClose}
        style={{
          padding: '12px 24px',
          backgroundColor: '#555',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Cancel
      </button>
      <button
        onClick={onNext}
        style={{
          padding: '12px 24px',
          backgroundColor: '#9147ff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        Next: Create Account →
      </button>
    </div>
  </div>
);

const CreateAccountStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  openUrl: (url: string) => void;
}> = ({ onNext, onBack, openUrl }) => (
  <div>
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>📋 Instructions:</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <p style={{ color: '#ccc', marginBottom: '8px' }}>
          <strong>1. Go to Azure Portal</strong>
        </p>
        <button
          onClick={() => openUrl('https://portal.azure.com')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            marginLeft: '20px'
          }}
        >
          🌐 Open Azure Portal
        </button>
      </div>

      <div style={{ marginBottom: '20px', color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>2. Click "Start free" or "Sign in"</strong></p>
        <ul style={{ paddingLeft: '40px' }}>
          <li>If you have a Microsoft account, sign in</li>
          <li>If not, click "Create one!" to make a Microsoft account</li>
        </ul>
      </div>

      <div style={{ marginBottom: '20px', color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>3. Choose FREE account option</strong></p>
        <div style={{ 
          backgroundColor: '#2a4a2a', 
          padding: '12px', 
          borderRadius: '6px',
          marginTop: '8px',
          marginLeft: '20px',
          borderLeft: '3px solid #4CAF50'
        }}>
          <p style={{ margin: 0, fontSize: '14px' }}>
            ℹ️ The free tier includes Speech at no cost!<br/>
            ℹ️ You can use Azure without adding a credit card
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px', color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>4. Complete account setup</strong></p>
        <ul style={{ paddingLeft: '40px' }}>
          <li>Enter your email</li>
          <li>Verify your email</li>
          <li>Set up 2-factor authentication (recommended)</li>
        </ul>
      </div>

      <div style={{ 
        backgroundColor: '#2a4a2a', 
        padding: '12px', 
        borderRadius: '6px',
        borderLeft: '3px solid #4CAF50'
      }}>
        <p style={{ margin: 0, color: '#4CAF50', fontWeight: 'bold' }}>
          ✅ Once you're logged into Azure Portal, click Next
        </p>
      </div>
    </div>

    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
      <button
        onClick={onBack}
        style={{
          padding: '12px 24px',
          backgroundColor: '#555',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        style={{
          padding: '12px 24px',
          backgroundColor: '#9147ff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        Next →
      </button>
    </div>
  </div>
);

const CreateResourceStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  openUrl: (url: string) => void;
}> = ({ onNext, onBack, openUrl }) => (
  <div>
    <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '16px' }}>
      Now we'll create a Speech resource (this is what gives you access to the voices).
    </p>

    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>📋 Instructions:</h3>
      
      <div style={{ color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>1. In Azure Portal, click "Create a resource"</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          (Blue + button in top-left, or search bar)
        </p>

        <p style={{ marginTop: '16px' }}><strong>2. Search for "Speech"</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          Type: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>speech</code><br/>
          Select: "Speech" (with microphone icon 🎤) by Microsoft
        </p>

        <p style={{ marginTop: '16px' }}><strong>3. Click "Create"</strong></p>

        <p style={{ marginTop: '16px' }}><strong>4. Fill in the form:</strong></p>
        <div style={{ 
          paddingLeft: '20px',
          marginTop: '12px',
          backgroundColor: '#2a2a2a',
          padding: '16px',
          borderRadius: '6px'
        }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>Subscription:</strong> [Select your subscription]
          </p>
          
          <p style={{ marginBottom: '12px' }}>
            <strong>Resource Group:</strong><br/>
            → Click "Create new"<br/>
            → Name it: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>StreamSynthResources</code>
          </p>
          
          <p style={{ marginBottom: '12px' }}>
            <strong>Region:</strong> "East US"<br/>
            <span style={{ fontSize: '14px', color: '#999' }}>
              ℹ️ This determines where your data is processed<br/>
              ℹ️ We recommend East US for best performance
            </span>
          </p>
          
          <p style={{ marginBottom: '12px' }}>
            <strong>Name:</strong> "StreamSynthSpeech"<br/>
            <span style={{ fontSize: '14px', color: '#999' }}>
              ℹ️ Must be unique across Azure<br/>
              ℹ️ Try: "StreamSynthSpeech-[your-username]"
            </span>
          </p>
          
          <p style={{ marginBottom: '0' }}>
            <strong style={{ color: '#ff9800' }}>Pricing Tier:</strong> <strong style={{ color: '#4CAF50' }}>"Free F0"</strong><br/>
            <span style={{ fontSize: '14px', color: '#ff9800' }}>
              ⚠️ IMPORTANT: Select "Free F0" for 500k chars/month free!
            </span>
          </p>
        </div>

        <p style={{ marginTop: '16px' }}><strong>5. Click "Review + Create"</strong></p>
        <p style={{ marginTop: '16px' }}><strong>6. Click "Create"</strong></p>
        <p style={{ marginTop: '16px' }}><strong>7. Wait for deployment</strong> (usually 30-60 seconds)</p>
        <p style={{ marginTop: '16px' }}><strong>8. When you see "Your deployment is complete", click "Go to resource"</strong></p>
      </div>

      <div style={{ 
        backgroundColor: '#2a4a2a', 
        padding: '12px', 
        borderRadius: '6px',
        marginTop: '24px',
        borderLeft: '3px solid #4CAF50'
      }}>
        <p style={{ margin: 0, color: '#4CAF50', fontWeight: 'bold' }}>
          ✅ Once you're viewing your Speech resource, click Next
        </p>
      </div>
    </div>

    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
      <button
        onClick={onBack}
        style={{
          padding: '12px 24px',
          backgroundColor: '#555',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        style={{
          padding: '12px 24px',
          backgroundColor: '#9147ff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        Next →
      </button>
    </div>
  </div>
);

const GetCredentialsStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  openUrl: (url: string) => void;
}> = ({ onNext, onBack, openUrl }) => (
  <div>
    <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '16px' }}>
      Now we'll copy your API credentials so Stream Synth can connect to Azure.
    </p>

    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>📋 Instructions:</h3>
      
      <div style={{ color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>1. In your Speech resource, look at the left sidebar</strong></p>
        <p><strong>2. Under "Resource Management", click "Keys and Endpoint"</strong></p>
        <p><strong>3. You'll see two sections:</strong></p>
        
        <div style={{ 
          backgroundColor: '#2a2a2a',
          padding: '16px',
          borderRadius: '6px',
          marginTop: '12px',
          marginBottom: '12px',
          fontFamily: 'monospace'
        }}>
          <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #444' }}>
            <strong>KEY 1</strong><br/>
            <span style={{ color: '#999' }}>[••••••••••••••••••••••••••••]</span>
            {' '}👁️ Show | 📋 Copy
          </div>
          <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #444' }}>
            <strong>KEY 2</strong><br/>
            <span style={{ color: '#999' }}>[••••••••••••••••••••••••••••]</span>
            {' '}👁️ Show | 📋 Copy
          </div>
          <div>
            <strong>Location/Region:</strong> <span style={{ color: '#4CAF50' }}>eastus</span>
          </div>
        </div>

        <p><strong>4. Copy KEY 1:</strong></p>
        <ul style={{ paddingLeft: '40px', marginBottom: '16px' }}>
          <li>Click the 👁️ <strong>Show</strong> button to reveal the key</li>
          <li>Click the 📋 <strong>Copy</strong> button to copy it</li>
          <li style={{ fontSize: '14px', color: '#999' }}>
            ℹ️ Keys are 32 characters, look like: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>a1b2c3d4e5f6...</code>
          </li>
        </ul>

        <p><strong>5. Note your Region:</strong></p>
        <ul style={{ paddingLeft: '40px' }}>
          <li>Usually shown as "Location/Region: eastus"</li>
          <li>Common regions: eastus, westus, westeurope</li>
          <li style={{ fontSize: '14px', color: '#999' }}>
            ℹ️ This matches what you chose in Step 2
          </li>
        </ul>
      </div>

      <div style={{ 
        backgroundColor: '#4a2a2a', 
        padding: '12px', 
        borderRadius: '6px',
        marginTop: '24px',
        borderLeft: '3px solid #ff9800'
      }}>
        <p style={{ margin: 0, color: '#ff9800', fontWeight: 'bold' }}>
          ⚠️ Keep your API key secret! Don't share it with anyone.
        </p>
      </div>

      <div style={{ 
        backgroundColor: '#2a4a2a', 
        padding: '12px', 
        borderRadius: '6px',
        marginTop: '12px',
        borderLeft: '3px solid #4CAF50'
      }}>
        <p style={{ margin: 0, color: '#4CAF50', fontWeight: 'bold' }}>
          ✅ Once you've copied your key, click Next to enter it
        </p>
      </div>
    </div>

    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
      <button
        onClick={onBack}
        style={{
          padding: '12px 24px',
          backgroundColor: '#555',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        style={{
          padding: '12px 24px',
          backgroundColor: '#9147ff',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        Next →
      </button>
    </div>
  </div>
);

const EnterCredentialsStep: React.FC<{
  apiKey: string;
  region: string;
  onApiKeyChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onBack: () => void;
  onTest: () => void;
  regions: Array<{ value: string; label: string }>;
}> = ({ apiKey, region, onApiKeyChange, onRegionChange, onBack, onTest, regions }) => {
  const isValid = apiKey.trim().length >= 32;

  return (
    <div>
      <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '16px' }}>
        Paste your API key and select your region below:
      </p>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', color: '#fff', fontWeight: 'bold', marginBottom: '8px' }}>
          API Key:
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="Paste your KEY 1 here"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontFamily: 'monospace'
          }}
        />
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#999' }}>
          <p style={{ margin: '4px 0' }}>ℹ️ 32-character key from Azure Portal</p>
          <p style={{ margin: '4px 0' }}>ℹ️ Starts with letters and numbers</p>
          <p style={{ margin: '4px 0' }}>
            ℹ️ Example: <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</code>
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', color: '#fff', fontWeight: 'bold', marginBottom: '8px' }}>
          Region:
        </label>
        <select
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          {regions.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div style={{ marginTop: '8px', fontSize: '14px', color: '#999' }}>
          <p style={{ margin: '4px 0' }}>ℹ️ Must match the region from Azure Portal</p>
          <p style={{ margin: '4px 0' }}>ℹ️ Common: eastus, westus, westeurope</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ← Back
        </button>
        <button
          onClick={onTest}
          disabled={!isValid}
          style={{
            padding: '12px 24px',
            backgroundColor: isValid ? '#9147ff' : '#444',
            color: isValid ? '#fff' : '#888',
            border: 'none',
            borderRadius: '6px',
            cursor: isValid ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          Test Connection →
        </button>
      </div>
    </div>
  );
};

const TestConnectionStep: React.FC<{
  isLoading: boolean;
  error: string | null;
  testResult: WizardState['testResult'];
  onBack: () => void;
  onRetry: () => void;
  onNext?: () => void;
}> = ({ isLoading, error, testResult, onBack, onRetry, onNext }) => {
  if (isLoading) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: '#fff', marginBottom: '12px', fontWeight: 'bold' }}>
            Testing Connection...
          </div>
          <div style={{ color: '#ccc', fontSize: '14px', lineHeight: '2' }}>
            <p>⏳ Connecting to Azure Speech...</p>
            <p>⏳ Validating credentials...</p>
            <p>⏳ Fetching available voices...</p>
            <p style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
              This may take up to 30 seconds...
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← Cancel Test
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '20px', color: '#f44336', fontWeight: 'bold' }}>
            Connection Failed
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#4a2a2a',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '24px',
          borderLeft: '4px solid #f44336'
        }}>
          <p style={{ color: '#f44336', margin: 0 }}>{error}</p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '12px' }}>Common issues:</h3>
          <ul style={{ color: '#ccc', lineHeight: '1.8' }}>
            <li>Key copied incorrectly (missing characters)</li>
            <li>Wrong key selected (use KEY 1, not KEY 2)</li>
            <li>Spaces added before/after the key</li>
            <li>Key regenerated in Azure Portal</li>
            <li>Wrong region selected</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: '#2a3a4a',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '32px',
          borderLeft: '4px solid #2196F3'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>💡 Solution:</p>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
            <li>Go back to Azure Portal</li>
            <li>Navigate to: Keys and Endpoint</li>
            <li>Click 👁️ Show to reveal KEY 1</li>
            <li>Click 📋 Copy to copy it cleanly</li>
            <li>Verify the region matches</li>
            <li>Paste again</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← Back to Fix
          </button>
          <button
            onClick={onRetry}
            style={{
              padding: '12px 24px',
              backgroundColor: '#9147ff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (testResult?.success) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>✅</div>
          <div style={{ fontSize: '20px', color: '#4CAF50', marginBottom: '32px', fontWeight: 'bold' }}>
            Connection Successful!
          </div>
          <div style={{ color: '#ccc', fontSize: '16px', lineHeight: '2', marginBottom: '24px' }}>
            <p>✅ Credentials validated</p>
            <p>✅ Found {testResult.voiceCount}+ voices available</p>
          </div>
          {testResult.previewVoices && testResult.previewVoices.length > 0 && (
            <div style={{ 
              textAlign: 'left',
              backgroundColor: '#2a2a2a',
              padding: '16px',
              borderRadius: '6px',
              maxWidth: '500px',
              margin: '0 auto 24px auto'
            }}>
              <h4 style={{ color: '#fff', margin: '0 0 12px 0' }}>Preview:</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '14px', color: '#ccc' }}>
                {testResult.previewVoices.map((v, i) => (
                  <li key={i} style={{ padding: '4px 0' }}>
                    • {v.name} ({v.gender})
                  </li>
                ))}
                <li style={{ padding: '4px 0', color: '#999' }}>
                  ... and {(testResult.voiceCount || 400) - testResult.previewVoices.length}+ more!
                </li>
              </ul>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              backgroundColor: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  return null;
};

const SuccessStep: React.FC<{
  voiceCount: number;
  onComplete: () => void;
}> = ({ voiceCount, onComplete }) => (
  <div>
    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
      <div style={{ fontSize: '24px', color: '#4CAF50', fontWeight: 'bold' }}>
        Setup Complete!
      </div>
    </div>

    <div style={{ marginBottom: '24px', textAlign: 'center', color: '#ccc', fontSize: '16px' }}>
      <p>Your Azure Neural Voices are now ready to use!</p>
      <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>
        ✅ API Key saved securely<br/>
        ✅ {voiceCount}+ premium voices available<br/>
        ✅ Free tier active (500k characters/month)
      </p>
    </div>

    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '12px' }}>🎤 What's Next:</h3>
      
      <div style={{ color: '#ccc', lineHeight: '1.8' }}>
        <p><strong>1. Select an Azure voice in the Voice Settings tab</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          → Look for voices labeled "Azure Neural"<br/>
          → Preview voices with the 🔊 Test button
        </p>

        <p style={{ marginTop: '16px' }}><strong>2. Assign Azure voices to specific viewers</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          → Go to the Viewers tab<br/>
          → Search for a viewer<br/>
          → Choose an Azure voice just for them!
        </p>

        <p style={{ marginTop: '16px' }}><strong>3. Azure voices will be used automatically</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          → When TTS is enabled, chat messages will use Azure voices<br/>
          → Mixed voices are supported (some viewers Web Speech, some Azure)
        </p>

        <p style={{ marginTop: '16px' }}><strong>4. Monitor your usage</strong></p>
        <p style={{ paddingLeft: '20px', fontSize: '14px', color: '#999' }}>
          → Voice Settings tab shows usage stats<br/>
          → You'll get warnings at 80% and 95% of free tier
        </p>
      </div>
    </div>

    <div style={{ 
      backgroundColor: '#2a3a4a',
      padding: '16px',
      borderRadius: '6px',
      marginBottom: '32px',
      borderLeft: '4px solid #2196F3'
    }}>
      <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>💡 Tips:</p>
      <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc', lineHeight: '1.8' }}>
        <li>Neural voices sound more natural than Standard</li>
        <li>Try different voices to find your favorites</li>
        <li>Azure voices work great for international viewers</li>
      </ul>
    </div>

    <div style={{ textAlign: 'center' }}>
      <button
        onClick={onComplete}
        style={{
          padding: '16px 32px',
          backgroundColor: '#4CAF50',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 'bold'
        }}
      >
        Close and Start Using Azure →
      </button>
    </div>
  </div>
);
