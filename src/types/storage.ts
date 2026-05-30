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
}

export interface ExportResult {
  name: string;
  tld: string;
  status: string;
}
