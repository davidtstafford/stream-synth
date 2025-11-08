/**
 * Shared Validation Framework
 * 
 * Centralized validation rules and patterns
 * Used by both backend handlers and frontend components
 */

export type ValidationRuleType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'enum'
  | 'email'
  | 'url'
  | 'number'
  | 'custom';

export interface ValidationRule {
  type: ValidationRuleType;
  message?: string;
  // Type-specific parameters
  min?: number;
  max?: number;
  regex?: RegExp;
  values?: any[];
  validate?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Centralized validator for consistent validation across frontend and backend
 */
export class Validator {
  /**
   * Validate data against a schema
   */
  static validate<T extends Record<string, any>>(
    data: T | null | undefined,
    schema: Partial<Record<keyof T, ValidationRule[]>>
  ): ValidationResult {
    if (!data) {
      return {
        valid: false,
        errors: { _root: 'Data is required' }
      };
    }

    const errors: Record<string, string> = {};

    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key as keyof T];
      const ruleArray = rules as ValidationRule[];

      for (const rule of ruleArray) {
        const error = this.checkRule(value, rule, key as string);
        if (error) {
          errors[key] = error;
          break; // Stop at first error for this field
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Check a single validation rule
   */
  private static checkRule(value: any, rule: ValidationRule, fieldName: string): string | null {
    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          return rule.message || `${fieldName} is required`;
        }
        return null;

      case 'minLength':
        if (typeof value === 'string' && value.length < (rule.min || 0)) {
          return rule.message || `${fieldName} must be at least ${rule.min} characters`;
        }
        return null;

      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule.max || 0)) {
          return rule.message || `${fieldName} must not exceed ${rule.max} characters`;
        }
        return null;

      case 'pattern':
        if (typeof value === 'string' && rule.regex && !rule.regex.test(value)) {
          return rule.message || `${fieldName} format is invalid`;
        }
        return null;

      case 'enum':
        if (rule.values && !rule.values.includes(value)) {
          return rule.message || `${fieldName} must be one of: ${rule.values.join(', ')}`;
        }
        return null;

      case 'email':
        if (typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return rule.message || `${fieldName} must be a valid email`;
          }
        }
        return null;

      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value);
          } catch {
            return rule.message || `${fieldName} must be a valid URL`;
          }
        }
        return null;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return rule.message || `${fieldName} must be a number`;
        }
        if (rule.min !== undefined && value < rule.min) {
          return `${fieldName} must be at least ${rule.min}`;
        }
        if (rule.max !== undefined && value > rule.max) {
          return `${fieldName} must not exceed ${rule.max}`;
        }
        return null;

      case 'custom':
        if (rule.validate && !rule.validate(value)) {
          return rule.message || `${fieldName} validation failed`;
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Check a single field
   */
  static validateField(value: any, rules: ValidationRule[], fieldName: string): string | null {
    for (const rule of rules) {
      const error = this.checkRule(value, rule, fieldName);
      if (error) return error;
    }
    return null;
  }

  /**
   * Merge multiple validation results
   */
  static merge(...results: ValidationResult[]): ValidationResult {
    const errors: Record<string, string> = {};
    for (const result of results) {
      Object.assign(errors, result.errors);
    }
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}

/**
 * Preset validation schemas for common use cases
 */
export const ValidationSchemas = {
  // Settings
  settingKey: [{ type: 'required' as const }, { type: 'minLength', min: 1 }],
  settingValue: [{ type: 'required' as const }],

  // TTS
  voiceId: [{ type: 'required' as const }],
  ttsMessage: [
    { type: 'required' as const },
    { type: 'minLength', min: 1 },
    { type: 'maxLength', max: 5000 }
  ],

  // URLs & Webhooks
  webhookUrl: [
    { type: 'required' as const },
    { type: 'url', message: 'Must be a valid webhook URL' }
  ],

  // Credentials
  apiKey: [{ type: 'required' as const }, { type: 'minLength', min: 10 }],
  region: [{ type: 'required' as const }, { type: 'minLength', min: 2 }],

  // User Input
  username: [
    { type: 'required' as const },
    { type: 'minLength', min: 1 },
    { type: 'maxLength', max: 100 }
  ]
};
