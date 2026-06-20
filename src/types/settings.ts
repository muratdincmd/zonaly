// Global app settings stored as a single localStorage JSON blob.
// Theme, language, and UI scale stay in their own dedicated keys
// (zonaly.theme, zonaly.lang, zonaly.scale) and existing hooks/contexts —
// they are intentionally NOT duplicated here.
export interface ZonalySettings {
  autoStartEnabled: boolean;
  notificationsEnabled: boolean;
  defaultAlertOnAvailable: boolean;
  defaultAlertOnExpiry: boolean;
  defaultAlertOnChange: boolean;
  defaultExpiryAlertDays: number;
  defaultCheckIntervalHours: number;
  maxConcurrency: number;
}

export const DEFAULT_SETTINGS: ZonalySettings = {
  autoStartEnabled: false,
  notificationsEnabled: true,
  defaultAlertOnAvailable: true,
  defaultAlertOnExpiry: true,
  defaultAlertOnChange: true,
  defaultExpiryAlertDays: 30,
  defaultCheckIntervalHours: 24,
  maxConcurrency: 10,
};
