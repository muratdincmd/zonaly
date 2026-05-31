# Changelog

All notable changes to Zonaly are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Watchlist monitoring.** Each watchlist entry now has configurable monitoring
  settings: check interval (1 h / 3 h / 6 h / 12 h / 24 h / 48 h / weekly),
  alert types (available, change, expiry with configurable lead-time in days),
  and a freeform notes field. Settings are opened via a gear icon on each
  watchlist row or from the domain details modal.
- **Automatic background polling.** On app launch (3 s delay) and every
  15 minutes, all watchlist entries whose `next_check_at` has passed are
  checked automatically via `check_due_watchlist`.
- **Alert history.** Generated alerts are stored in a `watchlist_alerts` SQLite
  table and surfaced in a collapsible alert banner at the top of the Watchlist
  panel. Per-alert dismiss and a "Mark all read" action are available.
- **Unread alert badge.** The Watchlist button in the title bar shows a badge
  with the unread alert count when alerts are waiting.
- **"Check All Due" button** in the Watchlist panel header runs all overdue
  entries immediately; entries past their schedule are highlighted in the list.
- **`WatchlistSettingsModal` component** — interval chips, alert checkboxes,
  expiry-days input, notes textarea — accessible from both the Watchlist panel
  and the domain details modal.
- **`useMonitoring` hook** encapsulates the startup-delay + 15-minute polling
  logic; fire-and-forget, does not block the UI.
- **7 new Tauri commands:** `update_watchlist_settings`, `check_watchlist_entry_now`,
  `check_due_watchlist`, `get_watchlist_stats`, `get_watchlist_alerts`,
  `mark_watchlist_alert_read`, `mark_all_watchlist_alerts_read`.
- **Watchlist DB schema expanded** with 9 new columns:
  `last_registrar`, `last_expiry_date`, `check_interval_hours`, `next_check_at`,
  `alert_on_available`, `alert_on_expiry`, `alert_on_change`,
  `expiry_alert_days`, `notes`. Migration is backward-compatible with existing
  v0.7.0 databases — columns added via individual `ALTER TABLE` with
  duplicate-column errors suppressed.
- **New `watchlist_alerts` table** stores generated alerts with type, message,
  created-at, and read-at timestamps.
- **`WatchlistSettings` struct** groups the 6 alert/interval fields to keep
  Tauri command signatures within Clippy's `too_many_arguments` limit (7 args).
- **4 new Rust unit tests** covering `update_settings`, `get_due`, alert
  insert/read, and mark-read flows.
- **`watchlist.*` i18n keys** for all monitoring UI added to all 14 locales:
  interval labels, alert types, overdue state, settings labels, notes field.
- **`cargo t` alias** (`.cargo/config.toml`) — runs `cargo test --lib`,
  avoiding Windows Application Control blocking the `main.rs` test binary.

### Changed

- **WatchlistPanel** fully rewritten: collapsible alert banner with per-alert
  dismiss, "Check All Due" button with overdue badge, per-row settings gear,
  next-check label with overdue styling, monitoring indicator dot, panel footer
  showing total / unread / due counts.
- **DomainDetailsModal** shows a settings gear button when the domain is in the
  watchlist, opening `WatchlistSettingsModal` inline.
- **TitleBar** accepts a `watchlistUnread` prop and renders a numeric badge on
  the Watchlist button when unread alerts are present.
- **ResultRow** watchlist button stays fully visible (opacity 1) when the domain
  is actively watched.

---

## [0.7.0] — 2026-05-31

### Added

- **Local query history.** Every `check_domains` run is automatically recorded.
  Up to 100 entries are kept (FIFO). A slide-in **History panel** lets users
  restore any past search — domain names and TLD selection are replayed into the
  active tab with one click.
- **Saved sessions.** Users can save the current domain list + TLD selection as
  a named session (up to 50 stored). Sessions appear in the Saved tab of the
  History panel; names can be edited inline with a double-click.
- **Watchlist.** Each available or taken result row has a bookmark icon that
  adds/removes the domain from a watchlist (up to 200 entries). A dedicated
  **Watchlist panel** lists tracked domains, shows their last-checked status,
  and provides a per-domain "Check now" button.
- **CSV / JSON export.** When results are visible an Export toolbar appears at
  the bottom of the results. Content is generated in Rust and downloaded via
  `URL.createObjectURL` — no extra plugin required.
- **SQLite persistence.** History, sessions, and watchlist data are now stored
  in a SQLite database (`zonaly.db`) in the Tauri app-data directory via
  `rusqlite` (bundled). Data survives app restarts.
- **History & Watchlist icon buttons** in the Windows custom title bar and the
  native macOS/Linux header.
- **Bootstrap disk cache.** IANA RDAP bootstrap JSON is now cached to the
  Tauri app-data directory with a 24-hour TTL. Subsequent launches use the
  cached data instantly; on expiry the cache refreshes in-flight and falls
  back to stale data if the network is unavailable.
- **Request deduplication.** If the same domain+TLD is queried more than once
  concurrently (e.g. double-click on Check), only one network request is made.
  Duplicate callers subscribe to the first call's result via a tokio watch
  channel and reuse it without hitting the network again.
- **Retry with exponential backoff.** RDAP queries are retried up to 2 times
  on transient failure. Backoff: 500 ms before first retry, 1 500 ms before
  second. Rate-limited responses (429) wait 3 s before retry. Successful
  responses (200, 404) and non-retriable client errors (4xx) are never retried.
- **Per-request timeout tightened to 8 s** (down from 10 s). The reqwest
  client timeout is now aligned with the documented value.
- **Overall batch timeout (30 s).** If the full set of domain checks has not
  completed within 30 seconds, remaining in-flight tasks are cancelled and each
  unfinished query is emitted as a timeout error to the frontend.
- **12 new Tauri commands** for CRUD on history, sessions, watchlist, and export.
- **Rust unit tests** — 54 Rust tests total (Phase 6 + Phase 7 additions).
- **i18n.** `history.*`, `sessions.*`, `watchlist.*`, `export.*` keys added to
  all 14 supported locale files.

### Fixed

- **Bundle identifier** changed from `com.zonaly.app` to `com.zonaly.desktop`,
  resolving the macOS warning about `.app` suffix conflicting with the
  application bundle extension.
- `.cargo/config.toml` (gitignored) sets `target-dir` outside OneDrive to fix
  build-script blocking under Windows Application Control policy.

---

## [0.5.0] — 2026-05-29

### Added

- **Vitest test suite** — 70 frontend unit tests across three files:
  `sanitizeDomains.test.ts` (URL sanitization edge cases),
  `tabs.test.ts` (full tabs reducer coverage),
  `ExtensionPicker.test.ts` (TLD list invariants).
- **Rust unit tests** — 20 tests in `rdap/client.rs` and `rdap/whois.rs`
  covering HTTP-status → `DomainStatus` mapping, `.de` DENIC availability
  parsing, `.tr` NIC.tr parsing, and generic "no match" detection.
- **CI integration** — `npm test` added to the TypeScript job; `cargo test`
  added to the Rust job so tests run on every push and PR.
- **Coverage reporting** — `npm run test:coverage` produces an lcov report
  via `@vitest/coverage-v8` (no minimum threshold enforced yet).

---

## [0.4.0] — 2026-05-29

### Added

- **Domain details modal.** Clicking a Taken result row opens a themed modal
  showing registrar, registration / expiry / last-updated dates, nameservers,
  and EPP-style status codes (with human-readable, fully translated labels).
  Closes on ESC, on the backdrop click, or via the close button.
- **RDAP details parser** (`src-tauri/src/rdap/details.rs`). Extracts the
  registrar (vCard `fn`), the standard event dates, `nameservers[].ldhName`,
  and the `status` array from any RFC 9083 RDAP response.
- **Port-43 WHOIS fallback** (`src-tauri/src/rdap/whois.rs`). When a TLD has
  no RDAP endpoint, the backend now falls back to a port-43 `TcpStream`
  query. Initial parsers cover `.de` (DENIC) and `.tr` (NIC.tr) with a
  generic "no match" detector for everything else. `.de` and `.tr` removed
  from `TLDS_NO_RDAP` — they're now selectable in the picker.
- **`fetch_domain_details` Tauri command.** Returns a `DomainDetails`
  payload via RDAP, or a minimal record sourced from WHOIS (the modal shows
  a "limited details" note in that case).
- **Source tagging.** `DomainResult` now carries a `source: "rdap" | "whois"`
  field, surfaced as a badge in the details modal.
- **`details.*` i18n keys** added to all 14 supported locales, including
  human-readable labels for the most common EPP status codes
  (`clientTransferProhibited`, `redemptionPeriod`, etc.).

---

## [0.3.0] — 2026-05-29

### Added

- **Custom title bar (Windows)** — frameless window with a branded title bar
  rendered in React: Zonaly logo on the left, tab bar in the centre, language
  selector + theme toggle + minimize / maximize / close buttons on the right.
  macOS and Linux keep native window decorations.
- **Multi-tab support** — up to 20 independent tabs, each with fully isolated
  domain input, TLD selection, and results. Tabs are managed via `TabsContext`
  (React `useReducer`). Each tab gets one of 10 cycling accent colours shown as
  a left-side vertical bar.
- **Tab bar UX** — tabs shrink proportionally when space is tight (min 40 px,
  max 200 px); never wrap to a second line. Active tab highlighted with accent
  border. Hover shows a 2 px brand-purple bottom line. Right-click context menu:
  *Duplicate*, *Close*, *Close other tabs*, *Close tabs to the right*.
  Tab titles auto-update from queried domain names (e.g. `google, apple +2`).
- **Keyboard shortcuts** — `Ctrl+T` new tab, `Ctrl+W` close tab,
  `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle tabs, `Ctrl+1–9` switch by position.
- **Transparent splashscreen** — frameless 280 × 280 window with the Zonaly icon
  tile and an orbiting glow dot plays while the main window loads hidden, fixing
  FOUC (flash of unstyled content). Main window is resized, centred, and shown
  after the animation via the `close_splashscreen` Rust command.
- **Custom installer branding** — Windows NSIS gets a 150 × 57 header banner and
  164 × 314 sidebar image; macOS DMG gets a 660 × 400 background. All assets
  generated from `icon.svg` via `scripts/generate-installer-assets.mjs`.
- **Windows icon cache refresh** — NSIS `NSIS_HOOK_POSTINSTALL` calls
  `ie4uinit.exe -ClearIconCache` and `SHChangeNotify(SHCNE_ASSOCCHANGED)` so
  the desktop shortcut icon updates immediately after install or upgrade.
- **Toast improvements** — notification now appears below the title bar
  (`top: 36px + gap`). Enter animation drops in from above with a gentle zoom-in;
  exit animation floats back up with a zoom-out (smooth, not abrupt).
- **Tab i18n** — `tabs.*` keys added to all 14 supported locales.

### Fixed

- Rust clippy warning: `use tauri::Manager` gated behind
  `#[cfg(target_os = "windows")]` so CI passes on Linux/macOS runners.

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
