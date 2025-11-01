/**
 * Chat Commands Configuration Screen
 * Manage chat command settings, permissions, and rate limits
 */

import React, { useState, useEffect } from 'react';
import * as chatCommands from '../../services/chat-commands';

interface Command extends chatCommands.ChatCommandConfig {}

export const ChatCommandsScreen: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [usageStats, setUsageStats] = useState<chatCommands.ChatCommandUsage[]>([]);
  const [selectedCommandForStats, setSelectedCommandForStats] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    setLoading(true);
    const result = await chatCommands.getAllCommands();
    if (result.success && result.data) {
      setCommands(result.data);
    } else {
      console.error('Failed to load commands:', result.error);
    }
    setLoading(false);
  };

  const loadUsageStats = async (commandName?: string) => {
    const result = await chatCommands.getUsageStats(commandName, 50);
    if (result.success && result.data) {
      setUsageStats(result.data);
    }
  };

  const handleEdit = (command: Command) => {
    setEditingCommand({ ...command });
  };

  const handleCancel = () => {
    setEditingCommand(null);
  };

  const handleSave = async () => {
    if (!editingCommand) return;

    setSaving(true);
    const result = await chatCommands.updateCommand(editingCommand.command_name, {
      command_prefix: editingCommand.command_prefix,
      enabled: editingCommand.enabled,
      permission_level: editingCommand.permission_level,
      rate_limit_seconds: editingCommand.rate_limit_seconds,
      custom_response: editingCommand.custom_response
    });

    if (result.success) {
      await loadCommands();
      setEditingCommand(null);
    } else {
      alert(`Failed to update command: ${result.error}`);
    }
    setSaving(false);
  };

  const handleViewStats = async (commandName: string) => {
    setSelectedCommandForStats(commandName);
    await loadUsageStats(commandName);
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case 'viewer':
        return '#4CAF50';
      case 'moderator':
        return '#FF9800';
      case 'broadcaster':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'viewer':
        return '👤';
      case 'moderator':
        return '🛡️';
      case 'broadcaster':
        return '👑';
      default:
        return '❓';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="content">
        <h2>Chat Commands</h2>
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Loading commands...
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <h2>Chat Commands Configuration</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>ℹ️ Command Information</h3>
        <p style={{ margin: '5px 0', color: '#aaa' }}>
          All commands use the <code>~</code> prefix by default (e.g., <code>~hello</code>)
        </p>
        <p style={{ margin: '5px 0', color: '#aaa' }}>
          <strong>Viewer Commands:</strong> ~hello, ~voices, ~setvoice
        </p>
        <p style={{ margin: '5px 0', color: '#aaa' }}>
          <strong>Moderator Commands:</strong> ~mutevoice, ~unmutevoice, ~cooldownvoice, ~mutetts, ~unmutetts
        </p>
      </div>

      {/* Commands Table */}
      <div style={{ marginBottom: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2a2a2a' }}>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Enabled</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Command</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Permission</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Rate Limit</th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((command) => (
              <tr key={command.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    fontSize: '20px', 
                    color: command.enabled ? '#4CAF50' : '#999' 
                  }}>
                    {command.enabled ? '✅' : '❌'}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <code style={{ 
                    backgroundColor: '#333', 
                    padding: '2px 6px', 
                    borderRadius: '3px',
                    color: '#9147ff'
                  }}>
                    {command.command_prefix}{command.command_name}
                  </code>
                </td>
                <td style={{ padding: '10px', color: getPermissionColor(command.permission_level) }}>
                  {getPermissionIcon(command.permission_level)} {command.permission_level}
                </td>
                <td style={{ padding: '10px' }}>
                  {command.rate_limit_seconds}s
                </td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={() => handleEdit(command)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#9147ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleViewStats(command.command_name)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#555',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Stats
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCommand && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '30px',
            borderRadius: '8px',
            minWidth: '500px',
            maxWidth: '600px',
            border: '1px solid #555'
          }}>
            <h3 style={{ marginTop: 0 }}>
              Edit Command: <code style={{ color: '#9147ff' }}>{editingCommand.command_prefix}{editingCommand.command_name}</code>
            </h3>

            {/* Enabled Toggle */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editingCommand.enabled}
                  onChange={(e) => setEditingCommand({ ...editingCommand, enabled: e.target.checked })}
                  style={{ marginRight: '10px', cursor: 'pointer' }}
                />
                <span style={{ color: editingCommand.enabled ? '#4CAF50' : '#999' }}>
                  Command Enabled
                </span>
              </label>
            </div>

            {/* Permission Level */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                Permission Level:
              </label>
              <select
                value={editingCommand.permission_level}
                onChange={(e) => setEditingCommand({ 
                  ...editingCommand, 
                  permission_level: e.target.value as 'viewer' | 'moderator' | 'broadcaster' 
                })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
              >
                <option value="viewer">👤 Viewer (Everyone)</option>
                <option value="moderator">🛡️ Moderator (Mods + Broadcaster)</option>
                <option value="broadcaster">👑 Broadcaster (Broadcaster Only)</option>
              </select>
            </div>

            {/* Rate Limit */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                Rate Limit (seconds):
              </label>
              <input
                type="number"
                min="0"
                max="3600"
                value={editingCommand.rate_limit_seconds}
                onChange={(e) => setEditingCommand({ 
                  ...editingCommand, 
                  rate_limit_seconds: parseInt(e.target.value) || 0 
                })}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px'
                }}
              />
              <small style={{ color: '#888', display: 'block', marginTop: '5px' }}>
                Minimum seconds between command uses per user
              </small>
            </div>

            {/* Custom Response (future feature) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                Custom Response (optional):
              </label>
              <textarea
                value={editingCommand.custom_response || ''}
                onChange={(e) => setEditingCommand({ 
                  ...editingCommand, 
                  custom_response: e.target.value || null 
                })}
                placeholder="Leave empty to use default response"
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#333',
                  color: 'white',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
              <small style={{ color: '#888', display: 'block', marginTop: '5px' }}>
                Custom response message (not yet implemented for all commands)
              </small>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancel}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#9147ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats Modal */}
      {selectedCommandForStats && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '30px',
            borderRadius: '8px',
            minWidth: '600px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid #555'
          }}>
            <h3 style={{ marginTop: 0 }}>
              Usage Statistics: <code style={{ color: '#9147ff' }}>~{selectedCommandForStats}</code>
            </h3>

            {usageStats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                No usage data available yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2a2a2a' }}>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>User</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Time</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageStats.map((stat, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '10px' }}>{stat.viewer_username}</td>
                        <td style={{ padding: '10px', color: '#888' }}>{formatDate(stat.executed_at)}</td>
                        <td style={{ padding: '10px' }}>
                          {stat.success ? (
                            <span style={{ color: '#4CAF50' }}>✅ Success</span>
                          ) : (
                            <span style={{ color: '#f44336' }}>
                              ❌ {stat.error_message || 'Failed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedCommandForStats(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
