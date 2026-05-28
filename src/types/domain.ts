export type DomainStatus =
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error"; message: string };

export interface DomainQuery {
  name: string;
  tld: string;
}

export interface DomainResult {
  name: string;
  tld: string;
  status: DomainStatus;
}
