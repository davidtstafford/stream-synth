/**
 * Chat Command Handler Service
 * 
 * Handles execution of chat commands from Twitch IRC.
 * Supports viewer and moderator commands with permission checking,
 * rate limiting, and usage tracking.
 * 
 * Phase 5: Chat Commands System
 */

import { ChatCommandsConfigRepository, ChatCommandConfig } from '../database/repositories/chat-commands-config';
import { ViewersRepository } from '../database/repositories/viewers';
import { VoicesRepository } from '../database/repositories/voices';
import { ViewerRulesRepository } from '../database/repositories/viewer-rules';
import { ViewerTTSRulesRepository, MuteConfig, CooldownConfig } from '../database/repositories/viewer-tts-rules';
import { TTSRepository } from '../database/repositories/tts';
import { reloadTTSSettings } from '../core/ipc-handlers/tts';

export interface ChatCommandContext {
  username: string;
  userId: string;
  isModerator: boolean;
  isBroadcaster: boolean;
  isSubscriber: boolean;
  isVip: boolean;
}

export class ChatCommandHandler {
  private commandsRepo: ChatCommandsConfigRepository;
  private viewersRepo: ViewersRepository;
  private voicesRepo: VoicesRepository;
  private voicePrefsRepo: ViewerRulesRepository;
  private viewerTTSRulesRepo: ViewerTTSRulesRepository;
  private ttsRepo: TTSRepository;
  
  // Rate limiting: Map<commandName_userId, lastExecutedTimestamp>
  private rateLimitMap: Map<string, number> = new Map();

  constructor() {
    this.commandsRepo = new ChatCommandsConfigRepository();
    this.viewersRepo = new ViewersRepository();
    this.voicesRepo = new VoicesRepository();
    this.voicePrefsRepo = new ViewerRulesRepository();
    this.viewerTTSRulesRepo = new ViewerTTSRulesRepository();
    this.ttsRepo = new TTSRepository();
  }

  /**
   * Process a chat message to check for commands
   * @returns Command response message if command was executed, null if no command found
   */
  async handleMessage(
    message: string,
    context: ChatCommandContext
  ): Promise<string | null> {
    // Check if message starts with a command prefix
    const enabledCommands = this.commandsRepo.getEnabled();
    
    for (const config of enabledCommands) {
      const fullCommand = `${config.command_prefix}${config.command_name}`;
      
      // Check if message starts with this command
      // Must be followed by space, end of string, or nothing (not part of a longer command)
      if (message.startsWith(fullCommand)) {
        // Make sure it's not part of a longer command (e.g., ~setvoice should not match ~setvoicespeed)
        const charAfterCommand = message.charAt(fullCommand.length);
        if (charAfterCommand && charAfterCommand !== ' ') {
          // This command name is a substring of a longer command, skip it
          continue;
        }

        // Check permissions
        if (!this.hasPermission(config.permission_level, context)) {
          console.log(`[ChatCommand] ${context.username} lacks permission for ${config.command_name}`);
          return null; // Silent fail - don't respond
        }

        // Check rate limit
        if (!this.checkRateLimit(config.command_name, context.userId, config.rate_limit_seconds)) {
          console.log(`[ChatCommand] ${context.username} rate limited for ${config.command_name}`);
          return null; // Silent fail - don't spam chat
        }

        // Extract args (everything after the command)
        const args = message.slice(fullCommand.length).trim().split(/\s+/).filter(arg => arg.length > 0);

        // Execute command
        try {
          const response = await this.executeCommand(config.command_name, args, context);
          
          // Record successful usage
          this.commandsRepo.recordUsage(
            config.command_name,
            context.userId,
            context.username,
            true
          );

          // Update rate limit
          this.updateRateLimit(config.command_name, context.userId);

          return response;
        } catch (error: any) {
          console.error(`[ChatCommand] Error executing ${config.command_name}:`, error);
          
          // Record failed usage
          this.commandsRepo.recordUsage(
            config.command_name,
            context.userId,
            context.username,
            false,
            error.message
          );

          return `❌ Error: ${error.message}`;
        }
      }
    }

    return null; // No matching command
  }

  /**
   * Check if user has permission to execute command
   */
  private hasPermission(
    requiredLevel: 'viewer' | 'moderator' | 'broadcaster',
    context: ChatCommandContext
  ): boolean {
    if (requiredLevel === 'viewer') {
      return true; // Everyone can use viewer commands
    }
    
    if (requiredLevel === 'moderator') {
      return context.isModerator || context.isBroadcaster;
    }
    
    if (requiredLevel === 'broadcaster') {
      return context.isBroadcaster;
    }
    
    return false;
  }

  /**
   * Check if user is rate limited for this command
   */
  private checkRateLimit(commandName: string, userId: string, limitSeconds: number): boolean {
    const key = `${commandName}_${userId}`;
    const lastExecuted = this.rateLimitMap.get(key);
    
    if (!lastExecuted) {
      return true; // No previous execution
    }
    
    const secondsSinceLastExecution = (Date.now() - lastExecuted) / 1000;
    return secondsSinceLastExecution >= limitSeconds;
  }

  /**
   * Update rate limit timestamp for user + command
   */
  private updateRateLimit(commandName: string, userId: string): void {
    const key = `${commandName}_${userId}`;
    this.rateLimitMap.set(key, Date.now());
  }

  /**
   * Execute specific command
   */
  private async executeCommand(
    commandName: string,
    args: string[],
    context: ChatCommandContext
  ): Promise<string> {
    switch (commandName) {
      case 'hello':
        return this.handleHello(context);
      
      case 'voices':
        return this.handleVoices(context);
      
      case 'setvoice':
        return this.handleSetVoice(args, context);
      
      case 'setvoicepitch':
        return this.handleSetVoicePitch(args, context);
      
      case 'setvoicespeed':
        return this.handleSetVoiceSpeed(args, context);
      
      case 'mutevoice':
        return this.handleMuteVoice(args, context);
      
      case 'unmutevoice':
        return this.handleUnmuteVoice(args, context);      case 'cooldownvoice':
        return this.handleCooldownVoice(args, context);
      
      case 'mutetts':
        return this.handleMuteTTS(context);
      
      case 'unmutetts':
        return this.handleUnmuteTTS(context);
      
      default:
        throw new Error('Unknown command');
    }
  }

  /**
   * Command: ~hello
   */
  private handleHello(context: ChatCommandContext): string {
    return `Hello @${context.username}! Welcome to the stream! 👋`;
  }
  /**
   * Command: ~voices
   */
  private handleVoices(context: ChatCommandContext): string {
    // Get total voice count
    const voices = this.voicesRepo.getAvailableVoices();
    const voiceCount = voices?.length || 0;
    
    return `🔊 We have ${voiceCount} TTS voices available! Use ~setvoice <voice_id> to set your voice. Ask the streamer or mods for voice recommendations!`;
  }

  /**
   * Command: ~setvoice <voice_id>
   */
  private async handleSetVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~setvoice <voice_id>');
    }

    const voiceId = args[0];

    // Validate voice exists
    const voice = this.voicesRepo.getVoiceById(voiceId);

    if (!voice) {
      throw new Error(`Voice "${voiceId}" not found. Ask a moderator for available voice IDs.`);
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(
      context.userId,
      context.username,
      context.username
    );

    if (!viewer) {
      throw new Error('Failed to create viewer record');
    }

    // Set voice preference
    this.voicePrefsRepo.upsert({
      viewer_id: viewer.id,
      voice_id: voiceId,
      provider: voice.provider,
      pitch: 1.0,
      speed: 1.0
    });

    const gender = voice.gender ? ` (${voice.gender})` : '';
    return `✅ @${context.username}, your TTS voice has been set to ${voice.name}${gender}`;
  }  /**
   * Command: ~mutevoice @user [mins]
   */
  private async handleMuteVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~mutevoice @username [minutes] (0 = permanent)');
    }

    const targetUsername = args[0].replace('@', '');
    const minutes = args.length > 1 ? parseInt(args[1]) : 0; // Default to permanent

    if (isNaN(minutes) || minutes < 0) {
      throw new Error('Invalid time. Use a number >= 0 (0 = permanent)');
    }

    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);
    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found in the database`);
    }

    // Add/update mute rule (no need to create viewer rule - restrictions are separate)
    const config: MuteConfig = {
      mute_period_mins: minutes === 0 ? null : minutes
    };
    this.viewerTTSRulesRepo.setMute(targetViewer.id, config);

    if (minutes === 0) {
      return `🔇 @${targetUsername} has been permanently muted from TTS`;
    } else {
      return `🔇 @${targetUsername} has been muted from TTS for ${minutes} minute(s)`;
    }
  }  /**
   * Command: ~unmutevoice @user
   */
  private async handleUnmuteVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~unmutevoice @username');
    }

    const targetUsername = args[0].replace('@', '');

    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);
    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found in the database`);
    }

    // Remove mute rule (no need to check/create viewer rule)
    this.viewerTTSRulesRepo.removeMute(targetViewer.id);

    return `✅ @${targetUsername} has been unmuted from TTS`;
  }

  /**
   * Command: ~cooldownvoice @user <gap_seconds> [period_mins]
   */
  private async handleCooldownVoice(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length < 2) {
      throw new Error('Usage: ~cooldownvoice @username <gap_seconds> [period_mins] (0 = permanent)');
    }

    const targetUsername = args[0].replace('@', '');
    const gapSeconds = parseInt(args[1]);
    const periodMins = args.length > 2 ? parseInt(args[2]) : 0; // Default to permanent

    if (isNaN(gapSeconds) || gapSeconds < 1 || gapSeconds > 300) {
      throw new Error('Gap must be between 1-300 seconds');
    }

    if (isNaN(periodMins) || periodMins < 0) {
      throw new Error('Period must be >= 0 minutes (0 = permanent)');
    }    // Get target viewer
    const targetViewer = this.viewersRepo.getByUsername(targetUsername);    if (!targetViewer) {
      throw new Error(`User @${targetUsername} not found in the database`);
    }

    // Add/update cooldown rule (no need to check/create viewer rule)
    const config: CooldownConfig = {
      cooldown_gap_seconds: gapSeconds,
      cooldown_period_mins: periodMins === 0 ? null : periodMins
    };
    this.viewerTTSRulesRepo.setCooldown(targetViewer.id, config);

    if (periodMins === 0) {
      return `⏰ @${targetUsername} now has a permanent ${gapSeconds} second TTS cooldown`;
    } else {
      return `⏰ @${targetUsername} now has a ${gapSeconds} second TTS cooldown for ${periodMins} minute(s)`;
    }
  }

  /**
   * Command: ~setvoicepitch <value>
   * Adjust pitch of viewer's TTS voice (0.5 = lower, 1.0 = normal, 2.0 = higher)
   */
  private async handleSetVoicePitch(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~setvoicepitch <value> (0.5-2.0)');
    }

    const pitchValue = parseFloat(args[0]);

    // Validate pitch is a number and in range 0.5-2.0
    if (isNaN(pitchValue) || pitchValue < 0.5 || pitchValue > 2.0) {
      throw new Error('Pitch must be between 0.5 and 2.0. Example: ~setvoicepitch 1.2');
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(
      context.userId,
      context.username,
      context.username
    );

    if (!viewer) {
      throw new Error('Failed to create viewer record');
    }

    // Check if viewer has a voice preference set
    const voicePref = this.voicePrefsRepo.getByViewerId(viewer.id);
    if (!voicePref) {
      throw new Error('You need to set a voice first! Use ~setvoice <voice_id>');
    }

    // Update pitch
    this.voicePrefsRepo.upsert({
      viewer_id: viewer.id,
      voice_id: voicePref.voice_id,
      provider: voicePref.provider,
      pitch: pitchValue,
      speed: voicePref.speed
    });

    return `🎵 @${context.username}, your voice pitch has been set to ${pitchValue} (${pitchValue < 1.0 ? 'lower' : pitchValue > 1.0 ? 'higher' : 'normal'})`;
  }

  /**
   * Command: ~setvoicespeed <value>
   * Adjust speed of viewer's TTS voice (0.5 = slower, 1.0 = normal, 2.0 = faster)
   */
  private async handleSetVoiceSpeed(args: string[], context: ChatCommandContext): Promise<string> {
    if (args.length === 0) {
      throw new Error('Usage: ~setvoicespeed <value> (0.5-2.0)');
    }

    const speedValue = parseFloat(args[0]);

    // Validate speed is a number and in range 0.5-2.0
    if (isNaN(speedValue) || speedValue < 0.5 || speedValue > 2.0) {
      throw new Error('Speed must be between 0.5 and 2.0. Example: ~setvoicespeed 1.5');
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(
      context.userId,
      context.username,
      context.username
    );

    if (!viewer) {
      throw new Error('Failed to create viewer record');
    }

    // Check if viewer has a voice preference set
    const voicePref = this.voicePrefsRepo.getByViewerId(viewer.id);
    if (!voicePref) {
      throw new Error('You need to set a voice first! Use ~setvoice <voice_id>');
    }

    // Update speed
    this.voicePrefsRepo.upsert({
      viewer_id: viewer.id,
      voice_id: voicePref.voice_id,
      provider: voicePref.provider,
      pitch: voicePref.pitch,
      speed: speedValue
    });

    return `⏱️ @${context.username}, your voice speed has been set to ${speedValue} (${speedValue < 1.0 ? 'slower' : speedValue > 1.0 ? 'faster' : 'normal'})`;
  }

  /**
   * Command: ~mutetts (globally disable TTS)
   */
  private async handleMuteTTS(context: ChatCommandContext): Promise<string> {
    const settings = this.ttsRepo.getSettings();
    
    console.log('[ChatCommand] ~mutetts - Current settings:', settings);
    console.log('[ChatCommand] ~mutetts - tts_enabled value:', settings?.tts_enabled, 'type:', typeof settings?.tts_enabled);
    
    // Check if TTS is already disabled (check the actual database field name)
    if (settings && settings.tts_enabled === false) {
      return '🔇 TTS is already disabled';
    }

    // Disable TTS (use the correct database field name)
    this.ttsRepo.saveSettings({ tts_enabled: false });
    
    console.log('[ChatCommand] ~mutetts - Settings saved, reloading TTS manager...');
    
    // Reload TTS manager settings
    await reloadTTSSettings();
    
    console.log('[ChatCommand] ~mutetts - TTS manager settings reloaded');
    
    return '🔇 TTS has been globally disabled';
  }

  /**
   * Command: ~unmutetts (globally enable TTS)
   */
  private async handleUnmuteTTS(context: ChatCommandContext): Promise<string> {
    const settings = this.ttsRepo.getSettings();
    
    // Check if TTS is already enabled (check the actual database field name)
    if (settings && settings.tts_enabled === true) {
      return '🔊 TTS is already enabled';
    }

    // Enable TTS (use the correct database field name)
    this.ttsRepo.saveSettings({ tts_enabled: true });
    
    // Reload TTS manager settings
    await reloadTTSSettings();
    
    return '🔊 TTS has been globally enabled';
  }

  /**
   * Get all command configurations (for UI)
   */
  getAllCommands(): ChatCommandConfig[] {
    return this.commandsRepo.getAll();
  }

  /**
   * Update command configuration (for UI)
   */
  updateCommand(commandName: string, updates: Partial<ChatCommandConfig>): void {
    this.commandsRepo.updateCommand(commandName, updates);
  }

  /**
   * Get usage statistics (for UI)
   */
  getUsageStats(commandName?: string, limit?: number) {
    return this.commandsRepo.getUsageStats(commandName, limit);
  }
}
