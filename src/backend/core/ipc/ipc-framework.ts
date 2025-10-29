/**
 * IPC Framework - Centralized request/response handling
 * 
 * Eliminates boilerplate by providing a consistent pattern for all IPC handlers
 * - Centralized error handling
 * - Unified response format
 * - Optional validation
 * - Optional response transformation
 */

import { ipcMain } from 'electron';

export interface IPCRequest<TIn = any> {
  validate?(input: TIn): string | null;
}

export interface IPCHandler<TIn = any, TOut = any> extends IPCRequest<TIn> {
  execute(input: TIn): Promise<TOut>;
  transform?(output: TOut): any;
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Central registry for all IPC handlers
 * Provides consistent error handling and response formatting
 */
export class IPCRegistry {
  private handlers = new Map<string, IPCHandler<any, any>>();

  /**
   * Register a new IPC handler with centralized error handling
   */
  register<TIn = any, TOut = any>(
    channel: string,
    handler: IPCHandler<TIn, TOut>
  ): void {
    ipcMain.handle(channel, async (event, input: TIn) => {
      try {
        // Validate input if validator provided
        const validationError = handler.validate?.(input);
        if (validationError) {
          console.warn(`[IPC] Validation error on ${channel}:`, validationError);
          return {
            success: false,
            error: validationError
          } as IPCResponse;
        }

        // Execute handler
        const result = await handler.execute(input);

        // Transform output if transformer provided
        const data = handler.transform?.(result) ?? result;

        return {
          success: true,
          data
        } as IPCResponse<TOut>;
      } catch (error: any) {
        console.error(`[IPC] Error in ${channel}:`, error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        } as IPCResponse;
      }
    });

    this.handlers.set(channel, handler);
  }

  /**
   * Get registered handler (for debugging/testing)
   */
  getHandler<TIn, TOut>(channel: string): IPCHandler<TIn, TOut> | undefined {
    return this.handlers.get(channel) as IPCHandler<TIn, TOut> | undefined;
  }

  /**
   * Get all registered channels
   */
  getChannels(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Global registry instance
export const ipcRegistry = new IPCRegistry();
