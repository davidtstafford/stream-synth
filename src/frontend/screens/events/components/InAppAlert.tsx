/**
 * In-App Alert Component
 * 
 * Displays alerts as popups within the Stream Synth application
 * Includes queue management and auto-dismiss functionality
 * 
 * Phase 10: Alert Preview & In-App Display
 */

import React, { useState, useEffect, useRef } from 'react';
import './InAppAlert.css';

export interface AlertPayload {
  id: string;
  event_type: string;
  channel_id: string;
  
  // Formatted event
  formatted: {
    html: string;
    plainText: string;
    emoji: string;
    variables: Record<string, any>;
  };
  
  // Text alert
  text?: {
    content: string;
    duration: number;
    position: string;
    style?: any;
  };
  
  // Sound alert
  sound?: {
    file_path: string;
    volume: number;
  };
  
  // Image alert
  image?: {
    file_path: string;
    duration: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  // Video alert
  video?: {
    file_path: string;
    volume: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  timestamp: string;
}

interface InAppAlertProps {
  alerts: AlertPayload[];
  onAlertDismiss: (id: string) => void;
}

interface DisplayAlert extends AlertPayload {
  isVisible: boolean;
  startTime: number;
}

/**
 * In-App Alert Display Component
 */
export const InAppAlert: React.FC<InAppAlertProps> = ({ alerts, onAlertDismiss }) => {
  const [displayAlerts, setDisplayAlerts] = useState<DisplayAlert[]>([]);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  // Process new alerts
  useEffect(() => {
    alerts.forEach(alert => {
      // Check if alert already exists
      if (displayAlerts.some(d => d.id === alert.id)) {
        return;
      }
      
      // Add to display queue
      const displayAlert: DisplayAlert = {
        ...alert,
        isVisible: false,
        startTime: Date.now()
      };
      
      setDisplayAlerts(prev => [...prev, displayAlert]);
      
      // Show with slight delay for animation
      setTimeout(() => {
        setDisplayAlerts(prev => prev.map(d => 
          d.id === alert.id ? { ...d, isVisible: true } : d
        ));
      }, 50);
      
      // Play sound if configured
      if (alert.sound) {
        playSound(alert.id, alert.sound.file_path, alert.sound.volume);
      }
      
      // Auto-dismiss after duration
      const duration = getDuration(alert);
      setTimeout(() => {
        dismissAlert(alert.id);
      }, duration);
    });
  }, [alerts]);
  
  // Get total duration for alert
  const getDuration = (alert: AlertPayload): number => {
    let maxDuration = 5000; // Default 5 seconds
    
    if (alert.text) {
      maxDuration = Math.max(maxDuration, alert.text.duration);
    }
    if (alert.image) {
      maxDuration = Math.max(maxDuration, alert.image.duration);
    }
    
    return maxDuration;
  };
  
  // Play sound alert
  const playSound = (id: string, filePath: string, volume: number) => {
    try {
      const audio = new Audio(`file://${filePath}`);
      audio.volume = volume;
      audioRefs.current.set(id, audio);
      audio.play().catch(err => {
        console.error('[InAppAlert] Error playing sound:', err);
      });
    } catch (err) {
      console.error('[InAppAlert] Error loading sound:', err);
    }
  };
  
  // Dismiss alert
  const dismissAlert = (id: string) => {
    // Fade out
    setDisplayAlerts(prev => prev.map(d => 
      d.id === id ? { ...d, isVisible: false } : d
    ));
    
    // Remove after animation
    setTimeout(() => {
      setDisplayAlerts(prev => prev.filter(d => d.id !== id));
      
      // Clean up audio
      const audio = audioRefs.current.get(id);
      if (audio) {
        audio.pause();
        audioRefs.current.delete(id);
      }
      
      // Clean up video
      const video = videoRefs.current.get(id);
      if (video) {
        video.pause();
        videoRefs.current.delete(id);
      }
      
      // Notify parent
      onAlertDismiss(id);
    }, 300);
  };
  
  // Get position for alert
  const getPosition = (alert: AlertPayload): string => {
    return alert.text?.position || 
           alert.image?.position || 
           alert.video?.position || 
           'top-right';
  };
  
  if (displayAlerts.length === 0) {
    return null;
  }
  
  return (
    <div className="inapp-alert-container">
      {displayAlerts.map(alert => (
        <div
          key={alert.id}
          className={`inapp-alert position-${getPosition(alert)} ${alert.isVisible ? 'show' : ''}`}
        >
          {/* Close Button */}
          <button
            className="alert-close-btn"
            onClick={() => dismissAlert(alert.id)}
            title="Dismiss alert"
          >
            ×
          </button>
          
          {/* Alert Content */}
          <div className="alert-content">
            {/* Emoji */}
            <div className="alert-emoji">{alert.formatted.emoji}</div>
            
            {/* Text Alert */}
            {alert.text && (
              <div 
                className="alert-text"
                dangerouslySetInnerHTML={{ __html: alert.text.content }}
              />
            )}
            
            {/* Image Alert */}
            {alert.image && (
              <div className="alert-image-container">
                <img
                  src={`file://${alert.image.file_path}`}
                  alt="Alert"
                  className="alert-image"
                  style={{
                    width: alert.image.width ? `${alert.image.width}px` : 'auto',
                    height: alert.image.height ? `${alert.image.height}px` : 'auto',
                    maxWidth: '100%',
                    maxHeight: '200px'
                  }}
                />
              </div>
            )}
            
            {/* Video Alert */}
            {alert.video && (
              <div className="alert-video-container">
                <video
                  ref={(el) => {
                    if (el) {
                      videoRefs.current.set(alert.id, el);
                      el.play().catch(err => {
                        console.error('[InAppAlert] Error playing video:', err);
                      });
                    }
                  }}
                  src={`file://${alert.video.file_path}`}
                  className="alert-video"
                  autoPlay
                  muted={false}
                  style={{
                    width: alert.video.width ? `${alert.video.width}px` : 'auto',
                    height: alert.video.height ? `${alert.video.height}px` : 'auto',
                    maxWidth: '100%',
                    maxHeight: '200px'
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Event Type Badge */}
          <div className="alert-badge">
            {alert.event_type.replace('channel.', '').replace('.', ' ')}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Alert Manager Hook
 * 
 * Manages alert queue and provides functions to add/remove alerts
 */
export const useAlertManager = () => {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  
  const addAlert = (alert: Omit<AlertPayload, 'id'>) => {
    const alertWithId: AlertPayload = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
    
    setAlerts(prev => [...prev, alertWithId]);
  };
  
  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };
  
  const clearAlerts = () => {
    setAlerts([]);
  };
  
  return {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts
  };
};
