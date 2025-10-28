/**
 * IPC Client - Frontend wrapper for IPC invocations
 * 
 * Centralizes response handling and error management on the frontend
 * - Consistent error handling
 * - Type-safe invocations
 * - Automatic response unwrapping
 */

const { ipcRenderer } = window.require('electron');

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AppError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Frontend IPC client with centralized error handling
 */
export class IPCClient {
  /**
   * Invoke an IPC handler and unwrap the response
   * @throws AppError if the handler returns success: false
   */
  async invoke<T = any>(channel: string, input?: any): Promise<T> {
    try {
      const response = (await ipcRenderer.invoke(channel, input)) as IPCResponse<T>;

      if (!response.success) {
        throw new AppError('IPC_ERROR', response.error || 'IPC call failed', 500);
      }

      return response.data as T;
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error(`[IPC Client] Error invoking ${channel}:`, error);
      throw new AppError('IPC_ERROR', error.message || 'IPC call failed', 500);
    }
  }

  /**
   * Invoke without throwing (returns null on error)
   */
  async invokeQuiet<T = any>(channel: string, input?: any): Promise<T | null> {
    try {
      return await this.invoke<T>(channel, input);
    } catch (error) {
      console.error(`[IPC Client] Error (quiet):`, error);
      return null;
    }
  }

  /**
   * Invoke and return raw response (for debugging)
   */
  async invokeRaw<T = any>(channel: string, input?: any): Promise<IPCResponse<T>> {
    return (await ipcRenderer.invoke(channel, input)) as IPCResponse<T>;
  }
}

// Global IPC client instance
export const ipcClient = new IPCClient();
