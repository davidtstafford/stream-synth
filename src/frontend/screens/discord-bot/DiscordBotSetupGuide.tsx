import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');

export interface DiscordBotSetupGuideProps {
  onClose: () => void;
  onBotStarted?: () => void;
}

/**
 * Discord Bot Setup Guide
 * 5-step guide for configuring the Discord bot with inline token input
 */
export const DiscordBotSetupGuide: React.FC<DiscordBotSetupGuideProps> = ({ onClose, onBotStarted }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tokenInput, setTokenInput] = useState('');
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleStartBotFromGuide = async () => {
    if (!tokenInput.trim()) {
      setSetupMessage({ type: 'error', text: 'Bot token is required' });
      return;
    }

    setIsStartingBot(true);
    setSetupMessage(null);
    try {
      const result = await ipcRenderer.invoke('discord:start-bot', tokenInput);
      if (result.success) {
        setSetupMessage({ type: 'success', text: result.message + ' ✓ Bot is now running!' });
        // Wait a bit for bot to initialize, then move to next step
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Automatically move to next step (Step 4: Invite to server)
        setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
        // Keep token hidden but notify parent component
        onBotStarted?.();
      } else {
        setSetupMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setSetupMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setIsStartingBot(false);
    }
  };

  const steps: Array<{
    title: string;
    instructions: string[];
    tips: string[];
    hasTokenInput?: boolean;
  }> = [
    {
      title: 'Create a Discord Application',
      instructions: [
        'Go to Discord Developer Portal: https://discord.com/developers/applications',
        'Click "New Application" and give it a name',
        'Go to the "Bot" section and click "Add Bot"',
        'Copy your bot token (you\'ll need this in Step 2)',
        'Keep this token SECRET - don\'t share it with anyone!'
      ],
      tips: [
        '💡 Your bot token is like a password - if someone has it, they can control your bot',
        '💡 You can regenerate the token if it\'s ever compromised'
      ]
    },
    {
      title: 'Add Redirect URI & Get Invite URL',
      instructions: [
        'Go to the "OAuth2" section (left sidebar)',
        'First, add a Redirect URI in the "Redirects" section:',
        '  • Click "Add Redirect"',
        '  • Enter: http://localhost:3000',
        '    (Stream Synth runs locally on your machine)',
        'Then select your redirect URI:',
        '  • In "Select redirect URL" dropdown, pick: http://localhost:3000',
        '    (This step is required or the URL won\'t generate!)',
        'In "OAuth2 URL Generator" select the SCOPE:',
        '  • bot',
        'Under "BOT PERMISSIONS" select these permissions:',
        '  • Send Messages',
        '  • Embed Links',
        '  • Read Message History',
        '  • Use Slash Commands',
        'Copy the generated URL at the bottom (blue box labeled "GENERATED URL")'
      ],
      tips: [
        '💡 IMPORTANT: You must add AND select the redirect URI - without both steps, no URL generates',
        '💡 Use http://localhost:3000 since Stream Synth is a local desktop app',
        '💡 Don\'t visit this URL yet - wait until Step 3 after you\'ve configured Stream Synth'
      ]
    },
    {
      title: 'Start the Bot in Stream Synth',
      instructions: [
        'Paste your bot token (from Step 1) into the input box below',
        'Click the "▶ Start Bot in Stream Synth" button',
        'Wait for the success message (it will take 1-2 seconds)',
        'Once successful, you\'ll automatically move to Step 4',
        'The guide stays open so you can continue with the next steps'
      ],
      tips: [
        '🎯 The bot MUST be running in Stream Synth BEFORE you authorize it in Discord',
        '💡 The token is stored securely in encrypted form and never leaves your computer',
        '💡 If "Start Bot" fails, check: Bot token is correct, Discord API is accessible',
        '⚠️ If you see "Disconnected" after the check mark, wait 5 seconds and try again'
      ],
      hasTokenInput: true
    },
    {
      title: 'Invite Bot to Your Discord Server',
      instructions: [
        'Open the OAuth2 URL from Step 2 in your browser',
        'Select your Discord server from the dropdown',
        'Review the permissions (bot, slash commands, etc.)',
        'Click "Authorize"',
        'Complete the CAPTCHA verification if prompted',
        '⚠️ You may see "Safari can\'t connect to server \'localhost\'" - this is EXPECTED and HARMLESS',
        '    The bot has already been authorized and added to your server - the error is just a browser limitation'
      ],
      tips: [
        '✓ You\'ve successfully authorized if: Bot appears in your server member list',
        '✓ Even if you see the "localhost" connection error, the authorization succeeded',
        '💡 You need "Manage Server" permission in Discord to authorize the bot',
        '💡 Desktop apps can\'t use normal OAuth callbacks, but the invitation still works!'
      ]
    },
    {
      title: 'Start Using Voice Discovery',
      instructions: [
        'Go to any channel in your Discord server',
        'Use the command: /findvoice',
        'Search for or preview available voices',
        'Viewers activate voices with ~setvoice in your Twitch chat',
        'Available voices update automatically as you add TTS providers',
        'Check /help for all available commands'
      ],
      tips: [
        '💡 All voice searching happens in Discord, keeping your Twitch chat clean',
        '💡 Voice selections happen in Twitch chat (/setvoice) for stream integration',
        '💡 If commands don\'t show up, try clicking outside the text box and typing again'
      ]
    }
  ];

  const step = steps[currentStep];

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
          <h2 style={{ margin: 0, fontSize: '1.5em' }}>
            🤖 Discord Bot Setup - Step {currentStep + 1} of {steps.length}
          </h2>
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

        {/* Content */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '1.2em' }}>
            {step.title}
          </h3>

          <div style={{ backgroundColor: '#36393F', borderRadius: '4px', padding: '12px', border: '1px solid #202225', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '0.95em' }}>Instructions:</h4>
            {step.instructions.map((instruction, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '14px', color: '#dcddde' }}>
                <span style={{ color: '#5865F2', fontWeight: 600, minWidth: '24px' }}>{idx + 1}.</span>
                <span>{instruction}</span>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: '#2C2F33', borderRadius: '4px', padding: '12px', border: '1px solid #202225', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '0.95em' }}>💡 Tips:</h4>
            {step.tips.map((tip, idx) => (
              <div key={idx} style={{ marginBottom: '8px', fontSize: '13px', color: '#b9bbbe' }}>
                {tip}
              </div>
            ))}
          </div>

          {/* Token Input - Only on Step 3 */}
          {step.hasTokenInput && (
            <div style={{ backgroundColor: '#36393F', borderRadius: '4px', padding: '12px', border: '1px solid #5865F2', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '0.95em' }}>🔑 Enter Your Bot Token:</h4>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Discord bot token here"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #202225',
                  backgroundColor: '#2a2a2a',
                  color: '#dcddde',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
                disabled={isStartingBot}
              />
              <div style={{ fontSize: '12px', color: '#b9bbbe', marginBottom: '12px' }}>
                ⚠️ Keep this token secret! Anyone with it can control your bot.
              </div>
              <button
                onClick={handleStartBotFromGuide}
                disabled={isStartingBot || !tokenInput.trim()}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: tokenInput.trim() ? '#5865F2' : '#5865F233',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isStartingBot || !tokenInput.trim() ? 'default' : 'pointer',
                  opacity: isStartingBot || !tokenInput.trim() ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {isStartingBot ? '🔄 Starting Bot...' : '▶ Start Bot in Stream Synth'}
              </button>
              {setupMessage && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: setupMessage.type === 'success' ? '#2d5016' : '#5d2c2c',
                  color: setupMessage.type === 'success' ? '#43B581' : '#FF6B6B',
                  fontSize: '13px',
                  textAlign: 'center'
                }}>
                  {setupMessage.type === 'success' ? '✓' : '✗'} {setupMessage.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '16px' }}>
          {Array.from({ length: steps.length }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: idx === currentStep ? '#5865F2' : idx < currentStep ? '#43B581' : '#dcddde',
                transition: 'background-color 0.2s'
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #202225',
              backgroundColor: '#36393F',
              color: '#dcddde',
              fontSize: '14px',
              fontWeight: 600,
              cursor: currentStep === 0 ? 'default' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            ← Previous
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#5865F2',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1,
                transition: 'all 0.2s'
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#43B581',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1,
                transition: 'all 0.2s'
              }}
            >
              Done ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
