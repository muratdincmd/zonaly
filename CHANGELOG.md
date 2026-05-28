# Changelog

All notable changes to Zonaly are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- **Smart domain input sanitization** — pasted URLs are automatically stripped of
  protocols (`http://`, `https://`), `www.` prefix, known TLD suffixes, and URL
  paths, leaving just the bare domain name. A toast notification appears when
  sanitization occurs, auto-dismissing after 3 seconds.
- **Language selector dropdown** — compact EN / TR / DE picker in the top-right
  corner. Custom popover (no native `<select>`); switches language instantly and
  persists to localStorage.
- **Animated theme toggle switch** — sliding toggle with sun/moon icon inside the
  thumb. Replaces the previous button.
- **Custom app icon** — indigo gradient rounded-rect with Z lettermark and globe arc
  overlays. Generated from `scripts/icon.svg` via `scripts/generate-icons.mjs`.
- **AppLogo component** — inline SVG icon mark + "Zon**aly**" wordmark in the header.

---

## [0.1.0] — 2026-05-28

### Added
- Initial scaffold: Tauri v2 + React 19 + TypeScript 5.8 + Vite 7.
- Parallel RDAP availability checks via IANA bootstrap (`https://data.iana.org/rdap/dns.json`).
- Streaming `domain-result` Tauri events — results appear as they arrive.
- 10-default + 15-extra TLD picker with "Show more" expander.
- Results split into Available / Taken / Error groups, preserving input order.
- i18n: English, Turkish, German with system locale auto-detection.
- Light/dark theme: system preference + manual override, persisted to localStorage.
- GitHub Actions: release workflow (Windows / macOS / Linux) and CI (typecheck + clippy).
