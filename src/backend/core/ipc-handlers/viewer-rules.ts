/**
 * Viewer Rules IPC Handlers
 * 
 * Handles viewer-specific TTS rules via IPC:
 * - Get viewer rules
 * - Create/Update/Delete rules
 * - Fetch all rules
 */

import { ipcMain } from 'electron';
import { getDatabase } from '../../database/connection';
import { ViewerRulesRepository } from '../../database/viewer-rules-repository';

let viewerRulesRepo: ViewerRulesRepository | null = null;

function getViewerRulesRepo(): ViewerRulesRepository {
  if (!viewerRulesRepo) {
    const db = getDatabase();
    viewerRulesRepo = new ViewerRulesRepository(db);
  }
  return viewerRulesRepo;
}

export function setupViewerRulesHandlers(): void {
  // Viewer Rules: Get
  ipcMain.handle('viewer-rules:get', async (event, username: string) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.getByUsername(username);
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error getting rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  // Viewer Rules: Create
  ipcMain.handle('viewer-rules:create', async (event, input: any) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.create(input);
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error creating rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  // Viewer Rules: Update
  ipcMain.handle('viewer-rules:update', async (event, username: string, updates: any) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.update(username, updates);
      if (!rule) {
        return { success: false, error: 'Rule not found', rule: null };
      }
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error updating rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  // Viewer Rules: Delete
  ipcMain.handle('viewer-rules:delete', async (event, username: string) => {
    try {
      const repo = getViewerRulesRepo();
      const deleted = repo.delete(username);
      return { success: deleted };
    } catch (error: any) {
      console.error('[ViewerRules] Error deleting rule:', error);
      return { success: false, error: error.message };
    }
  });

  // Viewer Rules: Get All
  ipcMain.handle('viewer-rules:get-all', async () => {
    try {
      const repo = getViewerRulesRepo();
      const rules = repo.getAll();
      return { success: true, rules };
    } catch (error: any) {
      console.error('[ViewerRules] Error getting all rules:', error);
      return { success: false, error: error.message, rules: [] };
    }
  });
}
