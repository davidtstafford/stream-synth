/**
 * Template Builder Component
 * 
 * Visual editor for creating custom alert templates with variable insertion
 * and preset templates for common alert types.
 */

import React, { useState, useRef, useEffect } from 'react';
import { getAvailableVariables } from '../../../../shared/utils/event-formatter';
import './TemplateBuilder.css';

interface TemplateBuilderProps {
  eventType: string;
  value: string;
  onChange: (template: string) => void;
  placeholder?: string;
}

interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  eventTypes?: string[]; // If specified, only show for these event types
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'simple',
    name: 'Simple Text',
    description: 'Basic username and event display',
    template: '{{username}} - {{event_type}}'
  },
  {
    id: 'follower',
    name: 'Follower Alert',
    description: 'Celebratory follower notification',
    template: '🎉 {{username}} just followed! Welcome to the community! 🎉',
    eventTypes: ['channel.follow']
  },
  {
    id: 'subscriber',
    name: 'Subscriber Alert',
    description: 'Thank subscriber with tier',
    template: '⭐ {{username}} subscribed at {{tier}}! Thank you for your support! ⭐',
    eventTypes: ['channel.subscribe', 'channel.subscription.message', 'channel.subscription.gift']
  },
  {
    id: 'cheer',
    name: 'Cheer Alert',
    description: 'Show bits amount and message',
    template: '💎 {{username}} cheered {{bits}} bits! "{{message}}" 💎',
    eventTypes: ['channel.cheer']
  },
  {
    id: 'raid',
    name: 'Raid Alert',
    description: 'Welcome raiders with viewer count',
    template: '🎯 {{username}} is raiding with {{viewers}} viewers! Welcome raiders! 🎯',
    eventTypes: ['channel.raid']
  },
  {
    id: 'chat-style',
    name: 'Twitch Chat Style',
    description: 'Formatted like Twitch chat messages',
    template: '<strong style="color: #9147ff">{{username}}</strong>: {{message}}',
    eventTypes: ['channel.chat.message']
  }
];

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  eventType,
  value,
  onChange,
  placeholder = 'Enter template text...'
}) => {
  const [showVariables, setShowVariables] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get available variables for current event type
  const availableVariables = eventType ? getAvailableVariables(eventType) : [];

  // Filter presets for current event type
  const relevantPresets = PRESET_TEMPLATES.filter(preset => 
    !preset.eventTypes || preset.eventTypes.includes(eventType)
  );

  // Track cursor position
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const handleSelect = () => {
        setCursorPosition(textarea.selectionStart);
      };
      textarea.addEventListener('select', handleSelect);
      textarea.addEventListener('click', handleSelect);
      textarea.addEventListener('keyup', handleSelect);
      return () => {
        textarea.removeEventListener('select', handleSelect);
        textarea.removeEventListener('click', handleSelect);
        textarea.removeEventListener('keyup', handleSelect);
      };
    }
  }, []);

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end);
    const variableText = `{{${variable}}}`;
    const newValue = before + variableText + after;
    
    onChange(newValue);
    
    // Set cursor after inserted variable
    setTimeout(() => {
      const newPosition = start + variableText.length;
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
      setCursorPosition(newPosition);
    }, 0);
    
    setShowVariables(false);
  };

  // Apply preset template
  const applyPreset = (template: string) => {
    onChange(template);
    setShowPresets(false);
    
    // Focus textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  // Handle textarea change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="template-builder">
      {/* Template Input */}
      <div className="template-input-container">
        <textarea
          ref={textareaRef}
          className="template-input"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          rows={4}
          spellCheck={false}
        />
        
        {/* Character count */}
        <div className="template-char-count">
          {value.length} characters
        </div>
      </div>

      {/* Action Buttons */}
      <div className="template-actions">
        <button
          type="button"
          className="template-action-btn variables-btn"
          onClick={() => setShowVariables(!showVariables)}
          disabled={!eventType}
          title={eventType ? 'Insert variable' : 'Select an event type first'}
        >
          ➕ Insert Variable
          {availableVariables.length > 0 && (
            <span className="variable-count">{availableVariables.length}</span>
          )}
        </button>

        <button
          type="button"
          className="template-action-btn presets-btn"
          onClick={() => setShowPresets(!showPresets)}
        >
          📋 Use Preset
          {relevantPresets.length > 0 && (
            <span className="preset-count">{relevantPresets.length}</span>
          )}
        </button>

        <button
          type="button"
          className="template-action-btn clear-btn"
          onClick={() => onChange('')}
          disabled={!value}
        >
          🗑️ Clear
        </button>
      </div>

      {/* Variables Panel */}
      {showVariables && (
        <div className="template-panel variables-panel">
          <div className="panel-header">
            <h4>Available Variables for {eventType}</h4>
            <button
              className="panel-close"
              onClick={() => setShowVariables(false)}
            >
              ✕
            </button>
          </div>
          
          {availableVariables.length > 0 ? (
            <div className="variable-list">
              {availableVariables.map(variable => (
                <button
                  key={variable}
                  className="variable-item"
                  onClick={() => insertVariable(variable)}
                  title={`Insert {{${variable}}}`}
                >
                  <code>{'{{'}{ variable}{'}}'}</code>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <p>No variables available for this event type.</p>
              <p className="hint">Variables are extracted from the event data structure.</p>
            </div>
          )}

          <div className="panel-hint">
            💡 Click a variable to insert it at the cursor position
          </div>
        </div>
      )}

      {/* Presets Panel */}
      {showPresets && (
        <div className="template-panel presets-panel">
          <div className="panel-header">
            <h4>Preset Templates</h4>
            <button
              className="panel-close"
              onClick={() => setShowPresets(false)}
            >
              ✕
            </button>
          </div>

          <div className="preset-list">
            {relevantPresets.length > 0 ? (
              relevantPresets.map(preset => (
                <div key={preset.id} className="preset-item">
                  <div className="preset-info">
                    <div className="preset-name">{preset.name}</div>
                    <div className="preset-description">{preset.description}</div>
                    <div className="preset-template">
                      <code>{preset.template}</code>
                    </div>
                  </div>
                  <button
                    className="preset-apply-btn"
                    onClick={() => applyPreset(preset.template)}
                  >
                    Apply
                  </button>
                </div>
              ))
            ) : (
              <div className="panel-empty">
                <p>No preset templates available for this event type.</p>
                <p className="hint">Try selecting a different event type or use the general presets below.</p>
              </div>
            )}

            {/* Show all presets if no relevant ones */}
            {relevantPresets.length === 0 && (
              <>
                <div className="panel-divider">All Presets</div>
                {PRESET_TEMPLATES.map(preset => (
                  <div key={preset.id} className="preset-item">
                    <div className="preset-info">
                      <div className="preset-name">{preset.name}</div>
                      <div className="preset-description">{preset.description}</div>
                      <div className="preset-template">
                        <code>{preset.template}</code>
                      </div>
                    </div>
                    <button
                      className="preset-apply-btn"
                      onClick={() => applyPreset(preset.template)}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="panel-hint">
            💡 Presets are customizable starting points - edit after applying!
          </div>
        </div>
      )}

      {/* Help Text */}
      {value && (
        <div className="template-help">
          <strong>Preview:</strong> Variables like <code>{'{{username}}'}</code> will be replaced with actual event data
        </div>
      )}
    </div>
  );
};
