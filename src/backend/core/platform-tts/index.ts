/**
 * Platform TTS Module
 * OS-specific Web Speech API initialization for Windows and macOS
 * 
 * Exports:
 * - PlatformTTSFactory: Main entry point for platform-specific initialization
 * - PlatformTTSHandler: Interface for OS-specific handlers
 */

export { PlatformTTSFactory } from './factory.js';
export type { PlatformTTSHandler } from './base.js';
