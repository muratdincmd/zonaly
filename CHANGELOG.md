# Changelog

All notable changes to Zonaly are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-05-28

### Added

- **Custom app icon** — indigo gradient rounded-rect with bold Z lettermark and
  globe arc overlays. Generated from `scripts/icon.svg` via
  `scripts/generate-icons.mjs` (all required PNG, ICO, ICNS sizes).
- **AppLogo component** — inline SVG icon mark + "Zon**aly**" wordmark in the
  header; `aly` rendered in the accent color.
- **Smart domain input sanitization** — pasted URLs are automatically cleaned:
  strips `http(s)://`, `www.` prefix, known TLD suffixes, URL paths, and
  trailing slashes. A toast notification appears at the top of the window when
  sanitization occurs, auto-dismisses after 3 seconds, dismissible on click.
- **Categorized TLD extension picker** — five collapsible sections:
  *Popular*, *Country Codes*, *Business & Professional*, *Creative & Design*,
  and *Tech & Startups*. Popular is open by default; others collapsed.
  Each section header includes a select-all checkbox (with indeterminate state),
  TLD count badge, and chevron toggle. Smooth collapse via CSS
  `grid-template-rows` animation.
- **Selected / available TLD counter** — meta row above the picker shows
  "N selected" (accent) and "N available" (muted) at all times.
- **RDAP-unavailable TLD indicators** — ccTLDs without RDAP support (`.de`,
  `.fr`, `.tr`, `.ru`, and others) are shown grayed-out with disabled checkboxes
  and a hover tooltip: "RDAP not available — coming in a future update"
  (translated for all languages).
- **Redesigned results list** — each row has a 3 px colored left border
  (green = available, red = taken, amber = error). Available rows show a green
  "Available" badge. Taken rows are slightly dimmed and restore on hover with a
  red tint. Domain split into bold name + muted TLD suffix.
- **Animated theme toggle switch** — sliding pill with sun/moon icon inside the
  white thumb; cross-fades with scale + rotate. Track fills accent color in dark
  mode.
- **Language selector redesigned as 3-column grid** — all 14 languages shown in
  a compact popup (210 px wide, no scroll). Active language highlighted with
  accent background and border.
- **Expanded language support** — 14 languages total: English, Turkish, German,
  Spanish, French, Italian, Portuguese, Russian, Chinese (Simplified), Japanese,
  Korean, Arabic, Dutch, Polish. System locale auto-detected; preference
  persisted to localStorage.
- **RTL layout for Arabic** — switching to AR sets `dir="rtl"` on `<html>`;
  header, footer, content area, result rows, and chips all flip direction.
- **Fixed header + fixed footer layout** — header sticks to viewport top;
  footer fixed at viewport bottom. Scrollable content area in between; custom
  5 px accent scrollbar at the window right edge.
- **Footer** — version number (links to GitHub Releases), separator, GitHub icon
  + username (links to author profile), and a UI scale control (70 %–150 %,
  step 5 %, persisted to localStorage).
- **UI scale control** — `−` / `+` buttons in the footer scale the entire
  content area via a CSS custom property; header and footer are unaffected.
- **`open_url` Tauri command** — opens URLs in the system default browser
  (Windows `start`, macOS `open`, Linux `xdg-open`), http/https-only.

### Changed

- TLD picker replaced: old flat "10 default + show more" toggle superseded by
  the categorized collapsible picker.
- Results container now rendered inside a bordered rounded panel with an inset
  shadow.
- Custom thin scrollbar (5 px, accent-colored thumb) applied throughout.

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
