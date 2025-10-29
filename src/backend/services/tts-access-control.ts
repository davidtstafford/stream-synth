import { TTSAccessRepository } from '../database/repositories/tts-access';
import { ViewerRulesRepository } from '../database/repositories/viewer-rules';
import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { ChannelPointGrantsRepository } from '../database/repositories/channel-point-grants';
import { SubscriptionsRepository } from '../database/repositories/subscriptions';
import { TTSRepository } from '../database/repositories/tts';
import { VoicesRepository } from '../database/repositories/voices';

export interface AccessValidationResult {
  canUseTTS: boolean;           // Can viewer use TTS at all?
  canUsePremiumVoices: boolean; // Can viewer use Azure/Google voices?
  voiceToUse: string | null;    // Final voice ID to use (after validation)
  pitch?: number;               // Pitch setting (from custom voice or default)
  speed?: number;               // Speed setting (from custom voice or default)
  reason?: string;              // Debug/log reason for denial
}

export class TTSAccessControlService {
  private accessRepo: TTSAccessRepository;
  private rulesRepo: ViewerRulesRepository;
  private rolesRepo: ViewerRolesRepository;
  private grantsRepo: ChannelPointGrantsRepository;
  private subscriptionsRepo: SubscriptionsRepository;
  private ttsRepo: TTSRepository;
  private voicesRepo: VoicesRepository;

  constructor() {
    this.accessRepo = new TTSAccessRepository();
    this.rulesRepo = new ViewerRulesRepository();
    this.rolesRepo = new ViewerRolesRepository();
    this.grantsRepo = new ChannelPointGrantsRepository();
    this.subscriptionsRepo = new SubscriptionsRepository();
    this.ttsRepo = new TTSRepository();
    this.voicesRepo = new VoicesRepository();
  }

  /**
   * Main validation entry point - called before TTS speaks
   */
  async validateAndDetermineVoice(
    viewerId: string,
    message: string
  ): Promise<AccessValidationResult> {
    try {
      // Get access config
      const config = this.accessRepo.getConfig();

      // Handle "Access to All" mode
      if (config.access_mode === 'access_all') {
        const customVoice = this.getViewerCustomVoice(viewerId);
        const globalVoice = this.getGlobalDefaultVoice();

        if (customVoice) {
          return {
            canUseTTS: true,
            canUsePremiumVoices: true,
            voiceToUse: customVoice.voice_id,
            pitch: customVoice.pitch,
            speed: customVoice.speed
          };
        }

        return {
          canUseTTS: true,
          canUsePremiumVoices: true,
          voiceToUse: globalVoice,
          pitch: 1.0,
          speed: 1.0
        };
      }

      // Handle "Limited Access" mode
      if (config.access_mode === 'limited_access') {
        const canAccess = this.checkAccessEligibility(viewerId, 'limited_access', config);

        if (!canAccess) {
          return {
            canUseTTS: false,
            canUsePremiumVoices: false,
            voiceToUse: null,
            reason: 'Viewer does not meet Limited Access criteria'
          };
        }

        // Viewer has access - use their custom voice or global
        const customVoice = this.getViewerCustomVoice(viewerId);
        const globalVoice = this.getGlobalDefaultVoice();

        if (customVoice) {
          return {
            canUseTTS: true,
            canUsePremiumVoices: true,
            voiceToUse: customVoice.voice_id,
            pitch: customVoice.pitch,
            speed: customVoice.speed
          };
        }

        return {
          canUseTTS: true,
          canUsePremiumVoices: true,
          voiceToUse: globalVoice,
          pitch: 1.0,
          speed: 1.0
        };
      }

      // Handle "Premium Voice Access" mode
      if (config.access_mode === 'premium_voice_access') {
        const canUsePremium = this.checkAccessEligibility(viewerId, 'premium_voice_access', config);
        const customVoice = this.getViewerCustomVoice(viewerId);
        const globalVoice = this.getGlobalDefaultVoice();

        // Everyone can use TTS, but voice depends on premium access
        if (customVoice) {
          const isPremium = this.isVoicePremium(customVoice.voice_id, customVoice.provider);

          if (isPremium && !canUsePremium) {
            // Viewer has premium voice set but no access - fallback to global
            return {
              canUseTTS: true,
              canUsePremiumVoices: false,
              voiceToUse: globalVoice,
              pitch: 1.0,
              speed: 1.0,
              reason: 'Premium voice access denied, using global default'
            };
          }

          // Viewer can use their custom voice
          return {
            canUseTTS: true,
            canUsePremiumVoices: canUsePremium,
            voiceToUse: customVoice.voice_id,
            pitch: customVoice.pitch,
            speed: customVoice.speed
          };
        }

        // No custom voice - use global
        return {
          canUseTTS: true,
          canUsePremiumVoices: canUsePremium,
          voiceToUse: globalVoice,
          pitch: 1.0,
          speed: 1.0
        };
      }

      // Shouldn't reach here, but default to allow access
      return {
        canUseTTS: true,
        canUsePremiumVoices: true,
        voiceToUse: this.getGlobalDefaultVoice(),
        pitch: 1.0,
        speed: 1.0,
        reason: 'Unknown access mode, defaulting to allow'
      };
    } catch (error: any) {
      console.error('[TTSAccessControl] Error validating viewer access:', error);
      // On error, default to denying access to be safe
      return {
        canUseTTS: false,
        canUsePremiumVoices: false,
        voiceToUse: null,
        reason: `Error: ${error.message}`
      };
    }
  }
  /**
   * Check if viewer passes access mode rules
   */
  private checkAccessEligibility(
    viewerId: string,
    mode: 'limited_access' | 'premium_voice_access',
    config: any
  ): boolean {
    const denyGifted = mode === 'limited_access'
      ? config.limited_deny_gifted_subs
      : config.premium_deny_gifted_subs;
    const allowVIP = mode === 'limited_access'
      ? config.limited_allow_vip
      : config.premium_allow_vip;
    const allowMod = mode === 'limited_access'
      ? config.limited_allow_mod
      : config.premium_allow_mod;
    const redeemName = mode === 'limited_access'
      ? config.limited_redeem_name
      : config.premium_redeem_name;

    // Check subscriber status (always checked first - required)
    const isSubEligible = this.checkSubscriptionEligibility(viewerId, denyGifted);
    if (isSubEligible) return true;

    // Check VIP status
    if (allowVIP) {
      const isVIP = this.checkVIPEligibility(viewerId);
      if (isVIP) return true;
    }

    // Check Moderator status
    if (allowMod) {
      const isMod = this.checkModeratorEligibility(viewerId);
      if (isMod) return true;
    }

    // Check channel point grant
    if (redeemName) {
      const hasGrant = this.checkRedeemEligibility(viewerId, mode);
      if (hasGrant) return true;
    }

    return false;
  }

  /**
   * Check if viewer is subscribed (and if gifted subs are allowed)
   */
  private checkSubscriptionEligibility(viewerId: string, denyGifted: boolean): boolean {
    const subscription = this.subscriptionsRepo.getByViewerId(viewerId);
    
    if (!subscription) {
      return false;
    }

    // If denying gifted subs, check if this is a gift
    if (denyGifted && subscription.is_gift === 1) {
      return false;
    }

    return true;
  }
  /**
   * Check if viewer has VIP role
   */
  private checkVIPEligibility(viewerId: string): boolean {
    return this.rolesRepo.isViewerVIP(viewerId);
  }

  /**
   * Check if viewer has Moderator role
   */
  private checkModeratorEligibility(viewerId: string): boolean {
    return this.rolesRepo.isViewerModerator(viewerId);
  }

  /**
   * Check if viewer has active channel point grant
   */
  private checkRedeemEligibility(
    viewerId: string,
    grantType: 'limited_access' | 'premium_voice_access'
  ): boolean {
    return this.grantsRepo.hasActiveGrant(viewerId, grantType);
  }

  /**
   * Determine if a voice ID is premium (Azure/Google)
   */
  private isVoicePremium(voiceId: string, provider: string): boolean {
    return provider === 'azure' || provider === 'google';
  }

  /**
   * Get the global default voice
   */
  private getGlobalDefaultVoice(): string {
    const settings = this.ttsRepo.getSettings();
    return settings.voice_id || '';
  }

  /**
   * Get viewer's custom voice preference
   */
  private getViewerCustomVoice(viewerId: string): {
    voice_id: string;
    provider: string;
    pitch: number;
    speed: number;
  } | null {
    return this.rulesRepo.getByViewerId(viewerId);
  }
}
