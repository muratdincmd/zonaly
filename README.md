# Zonaly

**Domain availability checker** — paste domain names, pick TLD extensions, and get real-time parallel results in a clean desktop app.

Built with Tauri v2 (Rust backend) + React + TypeScript. Queries the [RDAP](https://about.rdap.org/) protocol for reliable, structured availability data.

---

## Features

- **Multi-domain input** — one domain name per line (no prefixes or suffixes needed)
- **TLD picker** — 10 default extensions visible, 15 more available via "Show more"
- **Parallel queries** — all combinations checked concurrently (up to 10 at a time)
- **Streaming results** — available / taken / error groups appear as results come in, preserving your input order
- **i18n** — English, Turkish, German; auto-detected from system locale
- **Theme** — follows system light/dark preference with a manual override toggle

## Screenshots

> `npm run tauri dev` to see it in action — screenshots coming after Phase 3.

---

## Getting started

### Prerequisites

| Tool | Version |
|------|---------|
| [Rust](https://rustup.rs/) | 1.80+ |
| [Node.js](https://nodejs.org/) | 20+ |
| npm | 10+ |
| [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) | platform-specific |

On Windows you'll need the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

### Install & run

```bash
# Clone
git clone https://github.com/muratdincmd/zonaly.git
cd zonaly

# Install JS dependencies
npm install

# Start development (hot-reload for both Rust and React)
npm run tauri dev
```

### Production build

```bash
npm run tauri build
# → installer in src-tauri/target/release/bundle/
```

---

## How it works

```
User input
  └─► App.tsx parses names × selected TLDs → Vec<DomainQuery>
        └─► invoke("check_domains")
              └─► Rust: tokio::task per pair, bounded semaphore (10)
                    └─► RDAP IANA bootstrap → GET {base}/domain/{name}.{tld}
                          ├─ 200 → Taken  ──► emit("domain-result")
                          ├─ 404 → Available ► emit("domain-result")
                          └─ err → Error ───► emit("domain-result")
        ◄── listen("domain-result") accumulates into ordered Map
```

**RDAP** is the modern HTTPS/JSON protocol that replaced WHOIS. The app fetches the [IANA RDAP bootstrap](https://data.iana.org/rdap/dns.json) on first run to find the correct RDAP server per TLD. Most gTLDs and many ccTLDs are covered; a few ccTLDs (`.tr`, `.de`, `.fr`) may return "RDAP unavailable" errors — port-43 WHOIS fallback is planned for Phase 3.

---

## Project structure

```
zonaly/
├── src/                        # React frontend
│   ├── App.tsx                 # single-page layout + state
│   ├── components/             # DomainInput, ExtensionPicker, ResultsList, ThemeToggle
│   ├── hooks/useDomainCheck.ts # Tauri event listener + invoke
│   ├── i18n/locales/           # en.json, tr.json, de.json
│   ├── theme/ThemeProvider.tsx # system detect + manual override
│   └── types/domain.ts         # TS mirrors of Rust serde types
└── src-tauri/                  # Rust backend
    └── src/
        ├── commands.rs         # check_domains Tauri command
        ├── types.rs            # DomainQuery / DomainResult / DomainStatus
        └── rdap/               # IANA bootstrap + per-domain HTTP client
```

See [CLAUDE.md](CLAUDE.md) for developer guidelines, common edits, and architectural notes.

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Setup | ✅ Done | Tauri + React + TS scaffold, i18n, theme |
| 2 — Core | ✅ Done | Input → parallel RDAP queries → streaming results |
| 3 — Details | 🔜 Next | WHOIS popup (registrar, dates, nameservers), port-43 fallback |
| 4 — Polish | ⬜ | Animations, error UX, keyboard shortcuts, packaging |

---

## Development

```bash
npm run tauri dev       # run with hot-reload
npm run typecheck       # tsc --noEmit
npm run build           # Vite production build only

# From src-tauri/
cargo check
cargo clippy
cargo fmt
```

---

## License

MIT
