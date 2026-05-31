export interface HistoryEntry {
  id: number;
  timestamp: string;
  domains: string[];
  tldList: string[];
  availableCount: number;
  takenCount: number;
  errorCount: number;
}

export interface SavedSession {
  id: number;
  name: string;
  domains: string[];
  tldList: string[];
  createdAt: string;
}

export interface WatchlistEntry {
  id: number;
  domain: string;
  tld: string;
  addedAt: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastRegistrar: string | null;
  lastExpiryDate: string | null;
  checkIntervalHours: number;
  nextCheckAt: string | null;
  alertOnAvailable: boolean;
  alertOnExpiry: boolean;
  alertOnChange: boolean;
  expiryAlertDays: number;
  notes: string | null;
}

export interface WatchlistAlert {
  id: number;
  watchlistId: number;
  alertType: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface WatchlistStats {
  total: number;
  unreadAlerts: number;
  dueForCheck: number;
}

export interface ExportResult {
  name: string;
  tld: string;
  status: string;
}
