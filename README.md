# Zonaly

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Version](https://img.shields.io/github/v/release/muratdincmd/zonaly)

**Domain availability checker** — paste domain names, pick TLD extensions, and get real-time parallel results in a clean desktop app.

Built with [Tauri v2](https://v2.tauri.app/) (Rust) + React + TypeScript. Queries the [RDAP](https://about.rdap.org/) protocol — the modern, structured successor to WHOIS.

---

## Features

- **Multi-domain input** — one bare domain name per line (no `www.` or `.com` needed)
- **25 TLD extensions** — 10 default visible, 15 more via "Show more"
- **Parallel queries** — all name × TLD combinations checked concurrently (up to 10 at a time)
- **Streaming results** — Available / Taken / Error groups appear as results arrive, preserving your input order
- **Click for details** — click any Taken domain to see registrar, dates, and nameservers *(Phase 3)*
- **i18n** — English, Turkish, German; auto-detected from system locale, persisted across sessions
- **Theme** — follows system light/dark mode with a manual override toggle

---

## Screenshots

> Coming after Phase 3.

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
2. Select the TLD extensions you want to check
3. Click **Check availability**
4. Results stream in and are split into **Available** (green) and **Taken** (red) groups
5. Click any Taken domain to see WHOIS details *(coming in Phase 3)*

---

# For developers

## Architecture

```
User input
  └─► parse names × selected TLDs → Vec<DomainQuery>
        └─► invoke("check_domains")          [Tauri command]
              └─► tokio::task per pair, semaphore(10)
                    └─► IANA RDAP bootstrap → GET {base}/domain/{name}.{tld}
                          ├─ HTTP 200 → Taken    ─► emit("domain-result")
                          ├─ HTTP 404 → Available ► emit("domain-result")
                          └─ error   → Error    ─► emit("domain-result")
        ◄── listen("domain-result") → accumulate into ordered Map
```

[RDAP](https://about.rdap.org/) is an HTTPS/JSON protocol — no text parsing needed for availability checks. The app fetches the [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) on first run to discover the correct server per TLD. Coverage is broad for gTLDs (`.com`, `.net`, `.org`, `.io`, `.app`, `.dev`, `.ai` …) and most ccTLDs; a handful of ccTLDs (`.tr`, `.de`, `.fr`) have limited or no RDAP support and will show as errors — a port-43 WHOIS fallback is planned for Phase 3.

## Project structure

```
zonaly/
├── src/                         # React + TypeScript frontend
│   ├── App.tsx                  # single-page layout + state
│   ├── components/              # DomainInput, ExtensionPicker, ResultsList, ThemeToggle
│   ├── hooks/useDomainCheck.ts  # Tauri event listener + invoke
│   ├── i18n/locales/            # en.json, tr.json, de.json
│   ├── theme/ThemeProvider.tsx  # system detect + manual override
│   └── types/domain.ts          # TypeScript mirrors of Rust serde types
└── src-tauri/                   # Rust backend
    └── src/
        ├── commands.rs          # check_domains Tauri command
        ├── types.rs             # DomainQuery / DomainResult / DomainStatus
        └── rdap/                # IANA bootstrap cache + per-domain HTTP client
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
npm run tauri build      # production bundle → src-tauri/target/release/bundle/

# From src-tauri/
cargo check
cargo clippy
cargo fmt
```

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Setup | ✅ Done | Tauri + React + TS scaffold, i18n, theme |
| 2 — Core | ✅ Done | Input → parallel RDAP queries → streaming results |
| 3 — Details | 🔜 Next | WHOIS popup (registrar, dates, nameservers), port-43 fallback |
| 4 — Polish | ⬜ Planned | Animations, error UX, keyboard shortcuts, packaging |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching strategy, versioning policy, and release process.

---

## License

[MIT](LICENSE)
