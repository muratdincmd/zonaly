// All TLDs we know about — used to strip trailing suffixes from pasted URLs.
const KNOWN_TLDS = [
  "com","net","org","io","co","app","dev","ai","info","biz",
  "eu","uk","de","fr","tr","store","shop","online","tech","me",
  "us","ca","au","xyz","club","tv","cc","gg","fm","pm","re",
  "tf","wf","yt","ninja","website","site","blog","media","news",
];

// Build a single regex: strip protocol, www, any known TLD+path, trailing junk.
const PROTOCOL_RE  = /^https?:\/\//i;
const WWW_RE       = /^www\./i;
// Matches ".tld" optionally followed by port, path, query, fragment.
const TLD_SUFFIX_RE = new RegExp(
  `\\.(?:${KNOWN_TLDS.join("|")})(?:[/:?#].*)?$`,
  "i",
);
// Fallback: strip anything after the first "/" (catches unknown TLDs with paths)
const PATH_RE = /\/.*$/;

function sanitizeLine(raw: string): string {
  let s = raw.trim();
  s = s.replace(PROTOCOL_RE, "");
  s = s.replace(WWW_RE, "");
  // Strip port if present before first segment (e.g. "example.com:8080")
  s = s.replace(/:(\d+).*$/, "");
  // Strip known TLD + everything after
  s = s.replace(TLD_SUFFIX_RE, "");
  // Strip leftover paths for unknown TLDs (e.g. "example.shop/page" after TLD strip)
  s = s.replace(PATH_RE, "");
  // Remove trailing dots
  s = s.replace(/\.+$/, "");
  return s.toLowerCase();
}

export interface SanitizeResult {
  value: string;
  changed: boolean;
}

export function sanitizeDomains(raw: string): SanitizeResult {
  const lines = raw.split("\n");
  const sanitized = lines.map(sanitizeLine);
  const value = sanitized.join("\n");
  return { value, changed: value !== raw };
}
