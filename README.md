# Zonaly

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Version](https://img.shields.io/github/v/release/muratdincmd/zonaly)

**Fast, private, multilingual desktop domain availability checker.** Paste domain names, pick TLD extensions, and get real-time parallel results — no accounts, no servers, nothing leaves your machine except the RDAP queries themselves.

Built with [Tauri v2](https://v2.tauri.app/) (Rust) + React + TypeScript. Queries the [RDAP](https://about.rdap.org/) protocol — the modern, structured successor to WHOIS.

---

## Why Zonaly?

- **Native desktop, not a web tab.** Single-window Tauri app — opens instantly, integrates with the OS shell, no browser overhead.
- **Privacy by design.** No middleman server, no telemetry, no account. Queries go directly from your machine to the official RDAP endpoint for each TLD.
- **RDAP, not WHOIS.** Structured HTTPS/JSON responses instead of fragile WHOIS text parsing — faster, more reliable, and machine-readable.
- **Bulk parallel checks.** Dozens of names × dozens of TLDs in a single click, with results streaming in as they arrive.
- **Multilingual UX.** 14 languages with RTL support — auto-detected from your system locale.

---

## Features

### Input & search
- **Smart input sanitization** — paste full URLs (`https://example.com/page`) and the app strips protocols, `www.`, TLD suffixes, and paths automatically
- **Categorized TLD picker** — 5 collapsible categories (Popular, Country Codes, Business & Professional, Creative & Design, Tech & Startups), select-all per category, selected/available count
- **Multi-tab support** — up to 20 independent tabs, each with fully isolated domain input, TLD selection, and results; keyboard shortcuts `Ctrl+T` / `Ctrl+W` / `Ctrl+Tab` / `Ctrl+1–9`

### Results & details
- **Parallel RDAP queries** — all name × TLD combinations checked concurrently (up to 10 at a time), results stream in as they arrive
- **Streaming results** — Available / Taken / Error groups appear in real time, preserving your input order
- **Resilient & offline-friendly** — RDAP server list is cached locally for 24 hours; if the network is unavailable the app uses the cached list and retries failed queries up to twice before showing an error
- **Modern results UI** — colored left-border accent per status, "Available" badge, custom thin scrollbar
- **Domain details modal** — click any Taken domain to open a modal showing registrar, registration / expiry / last-updated dates, nameservers, EPP status codes, expiry countdown, and domain age
- **WHOIS fallback** — `.de` and `.tr` (and other ccTLDs without RDAP) are checked via port-43 WHOIS automatically; source badge (RDAP / WHOIS) shown in the details modal
- **External link** — open the registrar lookup page for any taken domain directly from the results

### History, sessions & watchlist
- **Query history** — every search is saved automatically to SQLite; restore any past search (domains + TLD selection) with one click from the History panel; up to 100 entries (FIFO)
- **Saved sessions** — save the current domain list + TLD selection as a named session; rename inline with a double-click; up to 50 sessions stored
- **Watchlist with monitoring** — bookmark any domain from results; the Watchlist panel shows last-checked status and a per-domain "Check now" button; configure per-entry monitoring settings (check interval: 1h–weekly, alert on available / change / expiry with configurable lead time); background auto-polling runs every 15 minutes; unread alert badge on the Watchlist button; up to 200 entries
- **Export results** — download results as CSV or JSON after any query; opens the Downloads folder automatically

### Reliability
- **Bootstrap disk cache** — RDAP server list cached locally for 24 hours; offline launches use the cached list without any network call
- **Retry with backoff** — failed RDAP queries retried up to 2× (500 ms / 1 500 ms delays); rate-limited responses (HTTP 429) wait 3 s before retry
- **Request deduplication** — duplicate domain+TLD queries within a batch share one network request
- **30 s batch timeout** — unfinished queries are cancelled and surfaced as errors after 30 seconds

### Interface & UX
- **14 languages** — EN, TR, DE, ES, FR, IT, PT, RU, ZH, JA, KO, AR, NL, PL; auto-detected from system locale, persisted across sessions
- **RTL support** — full right-to-left layout when Arabic is selected
- **Light / dark theme** — system preference auto-detected, manual override persisted
- **Animated theme toggle** — sliding pill switch with sun/moon icon inside the thumb
- **Fixed header & footer** — header always visible at top, footer always at bottom
- **UI scale control** — resize the content area from 70% to 150% via footer +/− buttons, persisted across sessions
- **Custom app icon** — indigo Z lettermark with globe arc overlays
- **Custom title bar (Windows)** — branded frameless title bar with logo, tab bar, language selector, theme toggle, and window controls; native chrome on macOS/Linux
- **Splashscreen** — transparent animated splash while the app loads, eliminating flash of unstyled content
- **Installer branding** — custom NSIS banner/sidebar (Windows) and DMG background (macOS); icon cache auto-refreshed after install on Windows

---

## Screenshots

<p align="center">
  <img src="public/screenshots/dark-theme.png" alt="Dark theme" width="49%" />
  &nbsp;
  <img src="public/screenshots/light-theme.png" alt="Light theme" width="49%" />
</p>

<p align="center">
  <img src="public/screenshots/dark-theme-results.png" alt="Dark theme — results" width="49%" />
  &nbsp;
  <img src="public/screenshots/light-theme-results.png" alt="Light theme — results" width="49%" />
</p>

---

# For users

## Download

Get the latest installer for your platform from the [Releases](https://github.com/muratdincmd/zonaly/releases) page:

| Platform | File |
|----------|------|
| Windows | `.msi` installer |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.AppImage` or `.deb` |

No additional runtime or dependencies needed — the installer is self-contained.

## Usage

1. Type or paste domain names — one per line, bare names only (e.g. `google`, `myproject`)  
   Full URLs are accepted and cleaned automatically (`https://www.example.com/page` → `example`)
2. Select TLD extensions from the categorized picker, or use "Select all" per category
3. Click **Check availability**
4. Results stream in and are split into **Available** (green) and **Taken** (red) groups
5. Click any **Taken** domain to open the details modal (registrar, dates, nameservers, expiry countdown)
6. Bookmark domains to your **Watchlist**, or save the whole search as a **Session** for later

## Supported languages

| Code | Language | RTL |
|------|----------|-----|
| EN | English | — |
| TR | Turkish | — |
| DE | German | — |
| ES | Spanish | — |
| FR | French | — |
| IT | Italian | — |
| PT | Portuguese | — |
| RU | Russian | — |
| ZH | Chinese (Simplified) | — |
| JA | Japanese | — |
| KO | Korean | — |
| AR | Arabic | ✓ |
| NL | Dutch | — |
| PL | Polish | — |

Language is auto-detected from your system locale and saved across sessions. Switch at any time via the language selector in the top-right corner.

---

# For developers

## Architecture

```
User input
  └─► sanitize (strip protocol / www / TLD / path)
        └─► parse names × selected TLDs → Vec<DomainQuery>
              └─► invoke("check_domains")               [Tauri command]
                    └─► tokio::task per pair, semaphore(10)
                          └─► IANA RDAP bootstrap (disk-cached 24h)
                                └─► GET {base}/domain/{name}.{tld}
                                      ├─ HTTP 200 → Taken    ──► emit("domain-result")
                                      ├─ HTTP 404 → Available ──► emit("domain-result")
                                      ├─ 429 / 5xx → retry×2 with backoff
                                      └─ no RDAP  → port-43 WHOIS fallback
                    └─► auto-save to SQLite history on completion
              ◄── listen("domain-result") → accumulate into ordered Map

Panel features (invoke on demand):
  History panel  ──► get_history / delete_history_entry / clear_history
  Sessions tab   ──► save_session / get_sessions / delete_session / rename_session
  Watchlist panel ─► add_to_watchlist / remove_from_watchlist / get_watchlist / update_watchlist_entry
  Monitoring      ──► update_watchlist_settings / check_watchlist_entry_now / check_due_watchlist /
                      get_watchlist_stats / get_watchlist_alerts / mark_watchlist_alert_read / mark_all_watchlist_alerts_read
  Export toolbar ──► export_results → Blob download (CSV or JSON)
  Details modal  ──► fetch_domain_details → RDAP / WHOIS registrar + dates + nameservers
```

**Why RDAP over WHOIS?** RDAP is a structured, standardized HTTPS/JSON protocol — availability is a clean HTTP status code (200 = taken, 404 = available) instead of brittle, registry-specific text parsing. The app fetches the [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) on first run to discover the correct server per TLD; ccTLDs without RDAP fall back to port-43 WHOIS automatically.

## Project structure

```
zonaly/
├── scripts/                        # icon + installer asset generation
├── src/                            # React + TypeScript frontend
│   ├── App.tsx                     # single-page layout + all top-level state
│   ├── components/
│   │   ├── AppLogo.tsx             # Z lettermark + wordmark
│   │   ├── AppFooter.tsx           # version, GitHub link, scale control
│   │   ├── DomainInput.tsx         # textarea with sanitization
│   │   ├── ExtensionPicker.tsx     # categorized TLD checkboxes
│   │   ├── HistoryPanel.tsx        # History + Saved sessions slide-in panel
│   │   ├── WatchlistPanel.tsx      # Watchlist slide-in panel
│   │   ├── DomainDetailsModal.tsx  # registrar / dates / nameservers modal
│   │   ├── ResultsList.tsx         # available / taken / error groups + export toolbar
│   │   ├── ResultRow.tsx           # single result row with watchlist + external link
│   │   ├── TabBar.tsx              # multi-tab bar (Windows title bar)
│   │   ├── TitleBar.tsx            # custom frameless title bar (Windows)
│   │   ├── ThemeToggle.tsx         # animated sun/moon toggle
│   │   ├── LanguageSelector.tsx    # 3-column language grid
│   │   └── Toast.tsx               # auto-dismissing notification
│   ├── context/TabsContext.tsx     # per-tab state via useReducer
│   ├── hooks/
│   │   ├── useDomainCheck.ts       # invoke + listen wrappers
│   │   ├── useMonitoring.ts        # background watchlist auto-check (15 min)
│   │   ├── useScale.ts             # UI zoom persistence
│   │   └── useToast.ts             # toast state management
│   ├── i18n/locales/               # 14 language JSON files
│   ├── theme/ThemeProvider.tsx     # system detect + manual override
│   ├── types/
│   │   ├── domain.ts               # DomainQuery / DomainResult / DomainStatus
│   │   └── storage.ts              # HistoryEntry / SavedSession / WatchlistEntry / WatchlistAlert / WatchlistStats
│   └── utils/sanitizeDomains.ts   # URL → bare domain name sanitizer
└── src-tauri/                      # Rust backend
    └── src/
        ├── commands.rs             # all Tauri commands (check_domains, history, sessions, watchlist, monitoring, export …)
        ├── types.rs                # DomainQuery / DomainResult / DomainStatus / DomainDetails
        ├── db/                     # SQLite persistence (rusqlite bundled)
        │   ├── mod.rs              # Database struct, WAL setup, schema init
        │   ├── history.rs          # history table CRUD
        │   ├── sessions.rs         # sessions table CRUD
        │   └── watchlist.rs        # watchlist table CRUD
        └── rdap/                   # RDAP + WHOIS backend
            ├── mod.rs              # RdapClient: semaphore, dedup, bootstrap cache
            ├── bootstrap.rs        # IANA bootstrap fetch + 24h disk cache
            ├── client.rs           # per-domain HTTP query + retry/backoff
            ├── details.rs          # RDAP domain details parser
            └── whois.rs            # port-43 WHOIS fallback (.de, .tr, generic)
```

## Prerequisites

| Tool | Version |
|------|---------|
| [Rust](https://rustup.rs/) | 1.80+ |
| [Node.js](https://nodejs.org/) | 20+ |
| npm | 10+ |
| [Tauri system deps](https://v2.tauri.app/start/prerequisites/) | platform-specific |

**Windows:** [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (pre-installed on Windows 11).

**Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` (see [ci.yml](.github/workflows/ci.yml) for exact packages).

## Setup & commands

```bash
git clone https://github.com/muratdincmd/zonaly.git
cd zonaly
npm install
npm run tauri dev        # hot-reload for both Rust and React
```

```bash
npm run typecheck        # tsc --noEmit
npm test                 # Vitest unit tests (70 tests, run once)
npm run test:watch       # Vitest in watch mode
npm run test:coverage    # Vitest + lcov coverage report
npm run tauri build      # production bundle → src-tauri/target/release/bundle/

# From src-tauri/
cargo check
cargo clippy -- -D warnings
cargo test               # all Rust tests (Linux/macOS CI)
cargo t                  # lib-only tests — use on Windows to avoid Application Control blocking the main binary
cargo fmt

# Regenerate app icons after editing scripts/icon.svg
node scripts/generate-icons.mjs
```

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Setup | ✅ Done | Tauri + React + TS scaffold, i18n, theme |
| 2 — Core | ✅ Done | Input → parallel RDAP queries → streaming results |
| 2.x — UX | ✅ Done | Categorized TLD picker, sanitization, 14 languages, RTL, footer |
| 3 — Shell | ✅ Done | Custom title bar, multi-tab support, splashscreen, installer branding |
| 4 — Details | ✅ Done | Domain details modal (registrar, dates, nameservers, expiry countdown), port-43 WHOIS fallback (.de, .tr) |
| 5 — Testing | ✅ Done | 70 Vitest frontend tests, 54 Rust unit tests, sanitizer edge cases |
| 6 — Caching & Reliability | ✅ Done | Bootstrap disk cache (24h TTL), request dedup, retry/backoff, 30s batch timeout |
| 7 — Domain Intelligence | ✅ Done | Local query history, saved sessions, export CSV/JSON, domain watchlist, SQLite persistence |
| 8 — Watchlist Monitoring | ✅ Done | Per-entry scheduling (1h–weekly), alert types (available/change/expiry), alert banner, unread badge, background auto-poll |
| 9 — Background Service | ⬜ Planned | System tray, background checks, native OS notifications (expiry, availability changes) |
| 10 — Settings Panel | ⬜ Planned | Settings modal: cache management, notification prefs, monitoring intervals, About |
| 11 — Advanced DNS | ⬜ Planned | DNS record display (NS/MX/SOA/A), DNS health, registrar intelligence, parked domain detection |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy, versioning policy, and release process.

---

## License

[MIT](LICENSE)
