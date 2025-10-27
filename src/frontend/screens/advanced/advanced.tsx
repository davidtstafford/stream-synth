import React, { useState } from 'react';
import { ExportImport } from '../../components/ExportImport';

interface AdvancedScreenProps {
  userId?: string;
}

export const AdvancedScreen: React.FC<AdvancedScreenProps> = ({ userId }) => {
  const handleImportComplete = () => {
    // Optionally show a message or handle import completion
    console.log('Import completed');
  };

  return (
    <div className="content">
      <h1 className="screen-title">Advanced Settings</h1>
      
      <div style={{ color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
        <p>Advanced options for managing your application data and settings.</p>
      </div>

      <ExportImport 
        userId={userId}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};
