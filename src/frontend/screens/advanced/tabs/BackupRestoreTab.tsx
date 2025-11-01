import React from 'react';
import { ExportImport } from '../../../components/ExportImport';

interface BackupRestoreTabProps {
  userId?: string;
  onImportComplete: () => void;
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({
  userId,
  onImportComplete
}) => {
  return (
    <div>
      <ExportImport 
        userId={userId}
        onImportComplete={onImportComplete}
      />
    </div>
  );
};
