export type DomainStatus =
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error"; message: string };

export type Source = "rdap" | "whois";

export interface DomainQuery {
  name: string;
  tld: string;
}

export interface DomainResult {
  name: string;
  tld: string;
  status: DomainStatus;
  source?: Source;
}

export interface DomainDetails {
  name: string;
  tld: string;
  source: Source;
  registrar?: string;
  registered?: string;
  expires?: string;
  updated?: string;
  nameservers: string[];
  statuses: string[];
}
