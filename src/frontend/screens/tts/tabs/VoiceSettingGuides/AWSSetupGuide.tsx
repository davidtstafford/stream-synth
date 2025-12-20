import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');
const { shell } = window.require('electron');

export type AWSWizardStep = 
  | 'introduction'
  | 'create-account'
  | 'create-iam-user'
  | 'get-credentials'
  | 'enter-credentials'
  | 'test-connection'
  | 'success';

export interface AWSWizardState {
  currentStep: AWSWizardStep;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  includeNeuralVoices: boolean;
  isLoading: boolean;
  error: string | null;
  testResult: {
    success: boolean;
    voiceCount?: number;
    previewVoices?: Array<{ name: string; gender: string }>;
  } | null;
}

export interface AWSSetupGuideProps {
  onClose: () => void;
  onComplete: (accessKeyId: string, secretAccessKey: string, region: string, includeNeuralVoices: boolean) => void;
}

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 - US East (N. Virginia)' },
  { value: 'us-east-2', label: 'us-east-2 - US East (Ohio)' },
  { value: 'us-west-1', label: 'us-west-1 - US West (N. California)' },
  { value: 'us-west-2', label: 'us-west-2 - US West (Oregon)' },
  { value: 'af-south-1', label: 'af-south-1 - Africa (Cape Town)' },
  { value: 'ap-east-1', label: 'ap-east-1 - Asia Pacific (Hong Kong)' },
  { value: 'ap-south-1', label: 'ap-south-1 - Asia Pacific (Mumbai)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 - Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'ap-northeast-2 - Asia Pacific (Seoul)' },
  { value: 'ap-northeast-3', label: 'ap-northeast-3 - Asia Pacific (Osaka)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 - Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'ap-southeast-2 - Asia Pacific (Sydney)' },
  { value: 'ca-central-1', label: 'ca-central-1 - Canada (Central)' },
  { value: 'eu-central-1', label: 'eu-central-1 - Europe (Frankfurt)' },
  { value: 'eu-west-1', label: 'eu-west-1 - Europe (Ireland)' },
  { value: 'eu-west-2', label: 'eu-west-2 - Europe (London)' },
  { value: 'eu-west-3', label: 'eu-west-3 - Europe (Paris)' },
  { value: 'eu-south-1', label: 'eu-south-1 - Europe (Milan)' },
  { value: 'eu-north-1', label: 'eu-north-1 - Europe (Stockholm)' },
  { value: 'me-south-1', label: 'me-south-1 - Middle East (Bahrain)' },
  { value: 'sa-east-1', label: 'sa-east-1 - South America (São Paulo)' }
];

export const AWSSetupGuide: React.FC<AWSSetupGuideProps> = ({ onClose, onComplete }) => {
  const [state, setState] = useState<AWSWizardState>({
    currentStep: 'introduction',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    includeNeuralVoices: true,
    isLoading: false,
    error: null,
    testResult: null
  });

  const handleTestConnection = async () => {
    if (!state.accessKeyId.trim() || !state.secretAccessKey.trim()) {
      setState(prev => ({
        ...prev,
        error: 'Please enter both Access Key ID and Secret Access Key'
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      console.log('[AWSSetupGuide] Testing connection...');
      const result = await ipcRenderer.invoke('aws:test-connection', { 
        accessKeyId: state.accessKeyId,
        secretAccessKey: state.secretAccessKey,
        region: state.region,
        includeNeuralVoices: state.includeNeuralVoices
      });
      console.log('[AWSSetupGuide] Test result:', result);

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
          error: result.error || 'Failed to connect to AWS Polly'
        }));
      }
    } catch (error: any) {
      console.error('[AWSSetupGuide] Error testing connection:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to test connection'
      }));
    }
  };

  const handleComplete = () => {
    onComplete(state.accessKeyId, state.secretAccessKey, state.region, state.includeNeuralVoices);
    onClose();
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
          <h2 style={{ margin: 0, fontSize: '1.5em' }}>🟠 AWS Polly Setup</h2>
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

        {/* Step Content */}
        {state.currentStep === 'introduction' && (
          <IntroductionStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'create-account' }))}
          />
        )}

        {state.currentStep === 'create-account' && (
          <CreateAccountStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'create-iam-user' }))}
            openExternalLink={openExternalLink}
          />
        )}

        {state.currentStep === 'create-iam-user' && (
          <CreateIAMUserStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'get-credentials' }))}
            openExternalLink={openExternalLink}
          />
        )}

        {state.currentStep === 'get-credentials' && (
          <GetCredentialsStep
            onNext={() => setState(prev => ({ ...prev, currentStep: 'enter-credentials' }))}
          />
        )}

        {state.currentStep === 'enter-credentials' && (
          <EnterCredentialsStep
            accessKeyId={state.accessKeyId}
            secretAccessKey={state.secretAccessKey}
            region={state.region}
            includeNeuralVoices={state.includeNeuralVoices}
            isLoading={state.isLoading}
            error={state.error}
            onAccessKeyIdChange={(value) => setState(prev => ({ ...prev, accessKeyId: value, error: null }))}
            onSecretAccessKeyChange={(value) => setState(prev => ({ ...prev, secretAccessKey: value, error: null }))}
            onRegionChange={(value) => setState(prev => ({ ...prev, region: value }))}
            onNeuralVoicesChange={(value) => setState(prev => ({ ...prev, includeNeuralVoices: value }))}
            onTest={handleTestConnection}
            regions={AWS_REGIONS}
          />
        )}

        {state.currentStep === 'test-connection' && (
          <TestConnectionStep
            testResult={state.testResult}
            onNext={() => setState(prev => ({ ...prev, currentStep: 'success' }))}
          />
        )}

        {state.currentStep === 'success' && (
          <SuccessStep
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
};

// Individual step components
const IntroductionStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div>
    <h3>🎤 Welcome to Amazon Polly TTS!</h3>
    <p>Amazon Polly offers lifelike text-to-speech with:</p>
    <ul style={{ lineHeight: '1.8' }}>
      <li><strong>70+ voices</strong> across 30+ languages</li>
      <li><strong>Neural TTS</strong> for natural, human-like speech</li>
      <li><strong>Standard voices</strong> for cost-effective synthesis</li>
      <li><strong>SSML support</strong> for pronunciation control</li>
      <li><strong>Pay-as-you-go</strong> pricing (free tier available)</li>
    </ul>
    <div style={{ backgroundColor: '#1a4d2e', padding: '12px', borderRadius: '4px', marginTop: '15px', fontSize: '0.9em' }}>
      💵 <strong>Pricing:</strong> Neural voices: $16/million characters. Standard voices: $4/million characters. 
      Free tier: 5 million characters/month (Standard) or 1 million characters/month (Neural) for 12 months.
    </div>
    <div style={{ marginTop: '20px', textAlign: 'right' }}>
      <button
        onClick={onNext}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Get Started →
      </button>
    </div>
  </div>
);

const CreateAccountStep: React.FC<{ onNext: () => void; openExternalLink: (url: string) => void }> = ({ onNext, openExternalLink }) => (
  <div>
    <h3>Step 1: Create AWS Account</h3>
    <ol style={{ lineHeight: '1.8' }}>
      <li>Go to{' '}
        <a
          onClick={() => openExternalLink('https://aws.amazon.com')}
          style={{ color: '#ff9900', cursor: 'pointer', textDecoration: 'underline' }}
        >
          aws.amazon.com
        </a>
      </li>
      <li>Click <strong>"Create an AWS Account"</strong></li>
      <li>Complete the registration process (requires valid credit card)</li>
      <li>Verify your email address and phone number</li>
      <li>Choose <strong>"Free Tier"</strong> plan to start</li>
    </ol>
    <div style={{ backgroundColor: '#4a3a1a', padding: '12px', borderRadius: '4px', marginTop: '15px', fontSize: '0.9em' }}>
      ⚠️ <strong>Note:</strong> A credit card is required even for the free tier, but you won't be charged unless you exceed free tier limits.
    </div>
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
      <button
        onClick={onNext}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Next →
      </button>
    </div>
  </div>
);

const CreateIAMUserStep: React.FC<{ onNext: () => void; openExternalLink: (url: string) => void }> = ({ onNext, openExternalLink }) => (
  <div>
    <h3>Step 2: Create IAM User with Polly Access</h3>
    <ol style={{ lineHeight: '1.8' }}>
      <li>Go to{' '}
        <a
          onClick={() => openExternalLink('https://console.aws.amazon.com/iam/')}
          style={{ color: '#ff9900', cursor: 'pointer', textDecoration: 'underline' }}
        >
          IAM Console
        </a>
      </li>
      <li>Click <strong>"Users"</strong> in the left sidebar</li>
      <li>Click <strong>"Add users"</strong></li>
      <li>Enter a username (e.g., "stream-synth-polly")</li>
      <li>Select <strong>"Programmatic access"</strong></li>
      <li>Click <strong>"Next: Permissions"</strong></li>
      <li>Click <strong>"Attach existing policies directly"</strong></li>
      <li>Search for and select <strong>"AmazonPollyFullAccess"</strong></li>
      <li>Click <strong>"Next"</strong> through tags and review</li>
      <li>Click <strong>"Create user"</strong></li>
    </ol>
    <div style={{ backgroundColor: '#1a3a4a', padding: '12px', borderRadius: '4px', marginTop: '15px', fontSize: '0.9em' }}>
      🔒 <strong>Security:</strong> Using IAM users with specific permissions is more secure than using root account credentials.
    </div>
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
      <button
        onClick={onNext}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Next →
      </button>
    </div>
  </div>
);

const GetCredentialsStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div>
    <h3>Step 3: Get Your Credentials</h3>
    <p>After creating the IAM user, you'll see a success screen with your credentials:</p>
    <ul style={{ lineHeight: '1.8' }}>
      <li><strong>Access Key ID:</strong> A 20-character string (e.g., AKIAIOSFODNN7EXAMPLE)</li>
      <li><strong>Secret Access Key:</strong> A 40-character string (shown only once!)</li>
    </ul>
    <div style={{ backgroundColor: '#4a1a1a', padding: '12px', borderRadius: '4px', marginTop: '15px', fontSize: '0.9em' }}>
      ⚠️ <strong>Important:</strong> This is your ONLY chance to see the Secret Access Key. Download the CSV or copy it immediately!
    </div>
    <div style={{ backgroundColor: '#1a3a4a', padding: '12px', borderRadius: '4px', marginTop: '15px', fontSize: '0.9em' }}>
      💡 <strong>Tip:</strong> If you missed copying the secret key, you can delete the access key and create a new one.
    </div>
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
      <button
        onClick={onNext}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        I Have My Credentials →
      </button>
    </div>
  </div>
);

const EnterCredentialsStep: React.FC<{
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  includeNeuralVoices: boolean;
  isLoading: boolean;
  error: string | null;
  onAccessKeyIdChange: (value: string) => void;
  onSecretAccessKeyChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onNeuralVoicesChange: (value: boolean) => void;
  onTest: () => void;
  regions: Array<{ value: string; label: string }>;
}> = ({
  accessKeyId,
  secretAccessKey,
  region,
  includeNeuralVoices,
  isLoading,
  error,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onRegionChange,
  onNeuralVoicesChange,
  onTest,
  regions
}) => (
  <div>
    <h3>Step 4: Enter Your AWS Credentials</h3>
    <div style={{ marginTop: '20px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Access Key ID:
      </label>
      <input
        type="text"
        value={accessKeyId}
        onChange={(e) => onAccessKeyIdChange(e.target.value)}
        placeholder="AKIAIOSFODNN7EXAMPLE"
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#e0e0e0',
          fontSize: '1em',
          fontFamily: 'monospace'
        }}
      />
    </div>
    <div style={{ marginTop: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Secret Access Key:
      </label>
      <input
        type="password"
        value={secretAccessKey}
        onChange={(e) => onSecretAccessKeyChange(e.target.value)}
        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#e0e0e0',
          fontSize: '1em',
          fontFamily: 'monospace'
        }}
      />
    </div>
    <div style={{ marginTop: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
        Region:
      </label>
      <select
        value={region}
        onChange={(e) => onRegionChange(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#e0e0e0',
          fontSize: '1em'
        }}
      >
        {regions.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
    <div style={{ marginTop: '15px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={includeNeuralVoices}
          onChange={(e) => onNeuralVoicesChange(e.target.checked)}
          style={{ marginRight: '8px' }}
        />
        <span>Include Neural Voices (higher quality, costs more)</span>
      </label>
      <div style={{ backgroundColor: '#1a4d2e', padding: '8px', borderRadius: '4px', marginTop: '8px', fontSize: '0.85em' }}>
        💡 Neural voices sound more natural but cost 4x more than standard voices. Uncheck to use only standard voices.
      </div>
    </div>
    {error && (
      <div style={{ 
        marginTop: '15px', 
        padding: '12px', 
        backgroundColor: '#4a1a1a', 
        borderRadius: '4px',
        color: '#ff6b6b'
      }}>
        ❌ {error}
      </div>
    )}
    <div style={{ marginTop: '20px', textAlign: 'right' }}>
      <button
        onClick={onTest}
        disabled={isLoading}
        style={{
          backgroundColor: isLoading ? '#666' : '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isLoading ? 'Testing Connection...' : 'Test Connection →'}
      </button>
    </div>
  </div>
);

const TestConnectionStep: React.FC<{
  testResult: { success: boolean; voiceCount?: number; previewVoices?: Array<{ name: string; gender: string }> } | null;
  onNext: () => void;
}> = ({ testResult, onNext }) => (
  <div>
    <h3>✅ Connection Successful!</h3>
    <p>Your AWS credentials are valid and working.</p>
    <div style={{ backgroundColor: '#1a4d2e', padding: '15px', borderRadius: '4px', marginTop: '15px' }}>
      <div style={{ fontSize: '1.1em', marginBottom: '10px' }}>
        <strong>Found {testResult?.voiceCount || 0} AWS Polly voices</strong>
      </div>
      {testResult?.previewVoices && testResult.previewVoices.length > 0 && (
        <div>
          <p style={{ marginTop: '10px', marginBottom: '8px' }}>Sample voices:</p>
          <ul style={{ marginLeft: '20px' }}>
            {testResult.previewVoices.slice(0, 5).map((voice, idx) => (
              <li key={idx}>{voice.name} ({voice.gender})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
    <div style={{ marginTop: '20px', textAlign: 'right' }}>
      <button
        onClick={onNext}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Continue →
      </button>
    </div>
  </div>
);

const SuccessStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => (
  <div>
    <h3>🎉 Setup Complete!</h3>
    <p>Your AWS Polly credentials have been configured successfully.</p>
    <div style={{ backgroundColor: '#1a3a4a', padding: '15px', borderRadius: '4px', marginTop: '15px' }}>
      <p style={{ margin: '0 0 10px 0' }}><strong>Next steps:</strong></p>
      <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
        <li>Click "Finish" to save your credentials</li>
        <li>AWS Polly will sync available voices</li>
        <li>Select an AWS voice from the dropdown</li>
        <li>Test your setup with a sample message</li>
      </ul>
    </div>
    <div style={{ marginTop: '20px', textAlign: 'right' }}>
      <button
        onClick={onComplete}
        style={{
          backgroundColor: '#ff9900',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Finish Setup
      </button>
    </div>
  </div>
);
