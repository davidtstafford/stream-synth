/**
 * Alert Preview Component
 * 
 * Displays a live preview of how the alert will appear in the browser source
 * Shows text, image, and video alerts as they would be displayed
 * 
 * Phase 10: Alert Preview & In-App Display
 */

import React, { useState, useEffect } from 'react';
import { processTemplate, getAvailableVariables } from '../../../../shared/utils/event-formatter';
import './AlertPreview.css';

interface AlertPreviewProps {
  eventType: string;
  
  // Text Alert
  textEnabled: boolean;
  textTemplate: string | null;
  textPosition: string;
  textDuration: number;
  
  // Image Alert
  imageEnabled: boolean;
  imageFilePath: string | null;
  imagePosition: string;
  imageWidth: number | null;
  imageHeight: number | null;
  
  // Video Alert
  videoEnabled: boolean;
  videoFilePath: string | null;
  videoPosition: string;
  videoWidth: number | null;
  videoHeight: number | null;
}

/**
 * Get sample data for preview based on event type
 */
const getSampleEventData = (eventType: string): Record<string, any> => {
  // Get available variables for this event type
  const variables = getAvailableVariables(eventType);
  
  // Create sample data based on event type
  const sampleData: Record<string, any> = {
    username: 'SampleUser',
    event_type: eventType,
    timestamp: new Date().toISOString()
  };
  
  // Add event-specific sample data
  switch (eventType) {
    case 'channel.follow':
      sampleData.followed_at = new Date().toISOString();
      break;
      
    case 'channel.subscribe':
    case 'channel.subscription.message':
      sampleData.tier = 'Tier 1';
      sampleData.is_gift = false;
      sampleData.message = 'Love the stream!';
      break;
      
    case 'channel.subscription.gift':
      sampleData.tier = 'Tier 1';
      sampleData.total = 5;
      sampleData.cumulative_total = 50;
      break;
      
    case 'channel.cheer':
      sampleData.bits = 100;
      sampleData.message = 'Great content! Cheer100';
      break;
      
    case 'channel.raid':
      sampleData.from_broadcaster_user_name = 'RaiderUser';
      sampleData.viewers = 250;
      break;
      
    case 'channel.chat.message':
      sampleData.message = 'This is a sample chat message!';
      break;
      
    case 'channel.channel_points_custom_reward_redemption.add':
      sampleData.reward = 'Hydrate';
      sampleData.user_input = 'Staying healthy!';
      sampleData.cost = 500;
      break;
      
    case 'channel.hype_train.begin':
      sampleData.level = 2;
      sampleData.goal = 10000;
      sampleData.progress = 5000;
      break;
      
    default:
      // Add any variables from the schema with sample values
      variables.forEach(varName => {
        if (!sampleData[varName]) {
          sampleData[varName] = `Sample_${varName}`;
        }
      });
  }
  
  return sampleData;
};

export const AlertPreview: React.FC<AlertPreviewProps> = ({
  eventType,
  textEnabled,
  textTemplate,
  textPosition,
  textDuration,
  imageEnabled,
  imageFilePath,
  imagePosition,
  imageWidth,
  imageHeight,
  videoEnabled,
  videoFilePath,
  videoPosition,
  videoWidth,
  videoHeight
}) => {
  const [processedText, setProcessedText] = useState<string>('');
  const [showAlert, setShowAlert] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed by default
  
  // Process template whenever it changes
  useEffect(() => {
    if (textEnabled && textTemplate) {
      const sampleData = getSampleEventData(eventType);
      const processed = processTemplate(textTemplate, sampleData);
      setProcessedText(processed);
    } else {
      setProcessedText('');
    }
  }, [eventType, textEnabled, textTemplate]);
  
  // Handle preview trigger
  const triggerPreview = () => {
    setShowAlert(true);
    
    // Auto-hide after duration
    const duration = textEnabled ? textDuration : 3000;
    setTimeout(() => {
      setShowAlert(false);
    }, duration);
  };
  
  // Check if any alert type is enabled
  const hasAnyAlert = textEnabled || imageEnabled || videoEnabled;
  
  if (!eventType) {
    return (
      <div className="alert-preview-container">
        <div className="preview-placeholder">
          <div className="preview-icon">👁️</div>
          <p>Select an event type to preview the alert</p>
        </div>
      </div>
    );
  }
  
  if (!hasAnyAlert) {
    return (
      <div className="alert-preview-container">
        <div className="preview-placeholder">
          <div className="preview-icon">⚠️</div>
          <p>Enable at least one alert type to preview</p>
          <small>Enable Text, Image, or Video alerts</small>
        </div>
      </div>
    );
  }
    return (
    <div className={`alert-preview-container ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Preview Header */}
      <div className="preview-header">
        <div className="preview-title">
          <span className="preview-icon">👁️</span>
          <span>Alert Preview</span>
        </div>
        <div className="preview-actions">
          <button 
            className="preview-trigger-btn"
            onClick={triggerPreview}
            title="Show preview animation"
          >
            ▶️ Preview
          </button>
          <button
            className="preview-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand preview' : 'Collapse preview'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {/* Preview Stage (mimics browser source) */}
      <div className="preview-stage">
        <div className="preview-background">
          <div className="preview-grid"></div>
        </div>
        
        {showAlert && (
          <div className={`preview-alert show position-${textPosition || imagePosition || videoPosition}`}>
            {/* Text Alert */}
            {textEnabled && processedText && (
              <div className="preview-text" dangerouslySetInnerHTML={{ __html: processedText }} />
            )}
            
            {/* Image Alert */}
            {imageEnabled && imageFilePath && (
              <div className="preview-image-container">
                <img
                  src={`file://${imageFilePath}`}
                  alt="Alert preview"
                  className="preview-image"
                  style={{
                    width: imageWidth ? `${imageWidth}px` : 'auto',
                    height: imageHeight ? `${imageHeight}px` : 'auto',
                    maxWidth: '100%',
                    maxHeight: '300px'
                  }}
                />
              </div>
            )}
            
            {/* Video Alert */}
            {videoEnabled && videoFilePath && (
              <div className="preview-video-container">
                <video
                  src={`file://${videoFilePath}`}
                  className="preview-video"
                  muted
                  style={{
                    width: videoWidth ? `${videoWidth}px` : 'auto',
                    height: videoHeight ? `${videoHeight}px` : 'auto',
                    maxWidth: '100%',
                    maxHeight: '300px'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Preview Info */}
      <div className="preview-info">
        <div className="preview-info-item">
          <span className="info-label">Position:</span>
          <span className="info-value">{textPosition || imagePosition || videoPosition}</span>
        </div>
        {textEnabled && (
          <div className="preview-info-item">
            <span className="info-label">Duration:</span>
            <span className="info-value">{textDuration / 1000}s</span>
          </div>
        )}
        <div className="preview-info-item">
          <span className="info-label">Sample Data:</span>
          <span className="info-value">Using sample event data</span>
        </div>
      </div>
    </div>
  );
};
