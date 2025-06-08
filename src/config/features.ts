/**
 * Feature flags for SessionHub
 * 
 * This file controls which features are enabled in the application.
 * Features under development should be set to false until complete.
 * 
 * @see docs/SESSION_COMPLETION_RULES.md for guidelines
 */

export const FEATURES = {
  // Core features (completed)
  ERROR_DETECTION: true,
  TWO_ACTOR_MODEL: true,
  SESSION_MANAGEMENT: true,
  QUALITY_GATES: true,
  
  // Development features (completed)
  TYPESCRIPT_VALIDATION: true,
  BUILD_VALIDATION: true,
  GIT_PROTECTION: true,
  
  // In-progress features (disabled until complete)
  CLOUD_SYNC: true,            // ✅ Session 1.6: Real Supabase integration implemented
  AI_ASSISTANT: true,          // ✅ Session 1.6: Real Claude API integration implemented
  VOICE_COMMANDS: false,       // TODO: [Session 0.2.2] Add voice command support
  GITHUB_INTEGRATION: false,   // TODO: [Session 0.2.3] Full GitHub integration
  SLACK_INTEGRATION: false,    // TODO: [Session 0.2.4] Slack notifications
  
  // UI features (in development)
  DARK_MODE: false,           // TODO: [Session 0.2.5] Implement dark mode theme
  ADVANCED_ANALYTICS: false,  // TODO: [Session 0.2.6] Add usage analytics
  EXPORT_FEATURES: false,     // TODO: [Session 0.2.7] Export session data
  
  // Experimental features
  PLUGIN_SYSTEM: false,       // TODO: [Session 0.3.0] Plugin architecture
  MULTI_USER: false,          // TODO: [Session 0.3.1] Multi-user collaboration
  MOBILE_SYNC: false,         // TODO: [Session 0.3.2] Mobile app sync
} as const;

// Type for feature flags
export type FeatureFlag = keyof typeof FEATURES;

// Helper to check if a feature is enabled
export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURES[feature] === true;
}

// Helper to get all enabled features
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURES) as FeatureFlag[])
    .filter(feature => FEATURES[feature] === true);
}

// Helper to get all disabled features
export function getDisabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURES) as FeatureFlag[])
    .filter(feature => FEATURES[feature] === false);
}