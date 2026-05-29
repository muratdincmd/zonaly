import { describe, it, expect } from "vitest";
import { sanitizeDomains } from "./sanitizeDomains";

// Helper: sanitize a single line and return the cleaned value
function clean(input: string): string {
  return sanitizeDomains(input).value;
}

describe("sanitizeDomains", () => {
  // ── Protocol stripping ────────────────────────────────────────────────────

  it("strips https://", () => {
    expect(clean("https://example.com")).toBe("example");
  });

  it("strips http://", () => {
    expect(clean("http://example.com")).toBe("example");
  });

  it("strips HTTPS:// case-insensitively", () => {
    expect(clean("HTTPS://example.com")).toBe("example");
  });

  // ── www. prefix ───────────────────────────────────────────────────────────

  it("strips www. prefix", () => {
    expect(clean("www.example.com")).toBe("example");
  });

  it("strips www. after protocol", () => {
    expect(clean("https://www.example.com")).toBe("example");
  });

  it("strips WWW. case-insensitively", () => {
    expect(clean("WWW.example.com")).toBe("example");
  });

  // ── TLD suffix stripping ──────────────────────────────────────────────────

  it("strips .com", () => expect(clean("example.com")).toBe("example"));
  it("strips .net", () => expect(clean("example.net")).toBe("example"));
  it("strips .org", () => expect(clean("example.org")).toBe("example"));
  it("strips .io",  () => expect(clean("example.io")).toBe("example"));
  it("strips .dev", () => expect(clean("example.dev")).toBe("example"));
  it("strips .ai",  () => expect(clean("example.ai")).toBe("example"));
  it("strips .co",  () => expect(clean("example.co")).toBe("example"));

  // ── Path / query / fragment stripping ────────────────────────────────────

  it("strips path after TLD", () => {
    expect(clean("https://example.com/some/path")).toBe("example");
  });

  it("strips query string", () => {
    expect(clean("https://example.com?q=1")).toBe("example");
  });

  it("strips fragment", () => {
    expect(clean("http://example.com/page#anchor")).toBe("example");
  });

  it("strips port number", () => {
    expect(clean("example.com:8080")).toBe("example");
  });

  // ── Combined edge cases ───────────────────────────────────────────────────

  it("handles full URL with path and query", () => {
    expect(clean("https://www.example.com/path?q=1#frag")).toBe("example");
  });

  it("handles sub.domain.co.uk style (strips .uk, leaves .co as remainder)", () => {
    // The TLD regex matches the first known TLD suffix. ".uk" is matched first
    // (rightmost position wins for the regex engine — actually leftmost wins).
    // In practice .co is matched before .uk, so "sub.example.co" is the result.
    // This documents the current behaviour; multi-part TLDs are a known limitation.
    const result = clean("https://sub.example.co.uk/path?q=1");
    expect(result).toBe("sub.example.co");
  });

  it("handles http://www.test.io/page#anchor", () => {
    expect(clean("http://www.test.io/page#anchor")).toBe("test");
  });

  // ── Clean inputs pass through unchanged ──────────────────────────────────

  it("leaves already-clean domain unchanged", () => {
    expect(clean("google")).toBe("google");
  });

  it("leaves hyphenated domain unchanged", () => {
    expect(clean("my-project")).toBe("my-project");
  });

  // ── Whitespace and empty lines ────────────────────────────────────────────

  it("trims surrounding whitespace from a line", () => {
    expect(clean("  example.com  ")).toBe("example");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(clean("   ")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(clean("")).toBe("");
  });

  // ── Trailing dots ─────────────────────────────────────────────────────────

  it("strips trailing dot from a bare name (no TLD)", () => {
    // TLD regex requires the dot to be immediately followed by the TLD word;
    // "example.com." has a trailing dot after the TLD so the regex does not
    // match — the trailing dot is stripped, leaving "example.com".
    // This documents the current behaviour; it is a known limitation.
    expect(clean("example.com.")).toBe("example.com");
  });

  it("strips multiple trailing dots", () => {
    expect(clean("example...")).toBe("example");
  });

  // ── Multi-line input ──────────────────────────────────────────────────────

  it("sanitizes multiple lines independently", () => {
    const input = "https://google.com\nhttp://www.apple.org\nmeta";
    const { value, changed } = sanitizeDomains(input);
    expect(value).toBe("google\napple\nmeta");
    expect(changed).toBe(true);
  });

  it("reports changed=false when nothing changed", () => {
    const { changed } = sanitizeDomains("google\napple\nmeta");
    expect(changed).toBe(false);
  });

  it("preserves empty lines in multi-line input", () => {
    const input = "google\n\napple";
    const { value } = sanitizeDomains(input);
    expect(value).toBe("google\n\napple");
  });

  // ── Case normalisation ────────────────────────────────────────────────────

  it("lowercases the result", () => {
    expect(clean("GOOGLE.COM")).toBe("google");
  });

  it("lowercases mixed-case input", () => {
    expect(clean("MyProject.Dev")).toBe("myproject");
  });

  // ── Multiple dots / unusual inputs ───────────────────────────────────────

  it("handles domain with multiple subdomains", () => {
    // strips from first known TLD
    expect(clean("a.b.c.example.com")).toBe("a.b.c.example");
  });

  it("handles input that is just a TLD", () => {
    // ".com" alone → empty after strip
    expect(clean(".com")).toBe("");
  });

  it("handles numeric domains", () => {
    expect(clean("123.org")).toBe("123");
  });
});
