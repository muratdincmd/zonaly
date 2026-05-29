import { describe, it, expect } from "vitest";
import {
  TLDS_ALL,
  TLDS_DEFAULT,
  TLDS_NO_RDAP,
  TLD_CATEGORIES,
} from "./ExtensionPicker";

describe("TLD data", () => {
  // ── TLDS_ALL ────────────────────────────────────────────────────────────────

  it("TLDS_ALL contains no duplicates", () => {
    expect(TLDS_ALL.length).toBe(new Set(TLDS_ALL).size);
  });

  it("TLDS_ALL is not empty", () => {
    expect(TLDS_ALL.length).toBeGreaterThan(0);
  });

  it("TLDS_ALL contains common gTLDs", () => {
    for (const tld of ["com", "net", "org", "io", "dev", "app", "ai"]) {
      expect(TLDS_ALL).toContain(tld);
    }
  });

  // ── TLDS_DEFAULT ───────────────────────────────────────────────────────────

  it("TLDS_DEFAULT is a non-empty subset of TLDS_ALL", () => {
    expect(TLDS_DEFAULT.length).toBeGreaterThan(0);
    for (const tld of TLDS_DEFAULT) {
      expect(TLDS_ALL).toContain(tld);
    }
  });

  it("TLDS_DEFAULT contains no RDAP-unavailable TLDs", () => {
    for (const tld of TLDS_DEFAULT) {
      expect(TLDS_NO_RDAP.has(tld)).toBe(false);
    }
  });

  // ── TLDS_NO_RDAP ───────────────────────────────────────────────────────────

  it("TLDS_NO_RDAP does not contain .de (port-43 fallback now covers it)", () => {
    expect(TLDS_NO_RDAP.has("de")).toBe(false);
  });

  it("TLDS_NO_RDAP does not contain .tr (port-43 fallback now covers it)", () => {
    expect(TLDS_NO_RDAP.has("tr")).toBe(false);
  });

  it("TLDS_NO_RDAP does not contain any gTLD that has broad RDAP coverage", () => {
    const rdapCovered = ["com", "net", "org", "io", "app", "dev", "ai"];
    for (const tld of rdapCovered) {
      expect(TLDS_NO_RDAP.has(tld)).toBe(false);
    }
  });

  // ── TLD_CATEGORIES ─────────────────────────────────────────────────────────

  it("every category has a non-empty tlds array", () => {
    for (const cat of TLD_CATEGORIES) {
      expect(cat.tlds.length).toBeGreaterThan(0);
    }
  });

  it("every TLD in every category appears in TLDS_ALL", () => {
    for (const cat of TLD_CATEGORIES) {
      for (const tld of cat.tlds) {
        expect(TLDS_ALL).toContain(tld);
      }
    }
  });

  it("'popular' category exists and is open by default", () => {
    const popular = TLD_CATEGORIES.find((c) => c.key === "popular");
    expect(popular).toBeDefined();
    expect(popular?.openByDefault).toBe(true);
  });

  it("all expected categories are present", () => {
    const keys = TLD_CATEGORIES.map((c) => c.key);
    for (const expected of ["popular", "country", "business", "creative", "tech"]) {
      expect(keys).toContain(expected);
    }
  });
});
