# Release Watcher (Electron)

A desktop GUI app for monitoring app/version release sources from JSON or HTML pages.

TypeScript-first architecture with separated main/preload/renderer modules.

## Features

- GUI source management: create, edit, delete monitoring sources.
- Source types:
  - `json` with output selectors (example: `0.name`, `.data[].id`, `releases[0].version`).
  - `html` with CSS selectors and optional attribute extraction.
- Optional per-source request headers (curl-style API polling use case).
- Optional regex extraction for both source types.
- Local persistence of latest known values and poll history.
- Diffing via fingerprint:
  - string/number outputs compare by normalized value,
  - non-string/number outputs compare by SHA-256 hash.
- "New" badge logic: only shown for updates detected within the last 2 hours.
- Per-source poll and global "Poll All".
- Native system notifications when a source value changes.
- Auto-poll scheduler (configurable in UI, default every 30 minutes).

## Example default sources

- `https://windsurf.com/changelog`
- `https://developers.openai.com/codex/changelog/`
- `https://xcodereleases.com/data.json`

Both are editable or removable.

## Install and run

```bash
npm install
npm run dev
```

Production run (local):

```bash
npm start
```

## Developer workflow

```bash
# strict type-check only
npm run typecheck

# lint with strict TS-aware rules
npm run lint

# auto-fix lint issues
npm run lint:fix

# format
npm run format
```

Watch mode (auto-recompile + restart Electron on changes):

```bash
npm run dev:watch
```

## Build for macOS (`/Applications`)

```bash
npm install
npm run dist:mac
```

Build output goes to:

- `release/Release Watcher-0.1.0-*.dmg`
- `release/Release Watcher-0.1.0-*.zip`

Then:

1. Open the `.dmg`.
2. Drag `Release Watcher.app` into `/Applications`.
3. Launch from Applications.

## Data storage

The app stores data in a shared YAML file so dev/prod builds use the same config.

On macOS:

- `~/Library/Application Support/pl.alorenc.releasewatcher/config.yaml`

On other platforms:

- `<appData>/pl.alorenc.releasewatcher/config.yaml`

The file keeps:

- source definitions
- latest detected values
- timestamps (`lastPolledAt`, `lastChangeAt`)
- poll status and errors
- auto-poll settings
- unseen update badge count

Format note:

- The file is stored as YAML-compatible content (JSON subset), so it remains portable between dev/prod and safe to parse even in minimal runtimes.

Migration:

- On first run with this version, existing `release-watcher-data.json` from Electron userData is imported automatically into `config.yaml`.

## Notes

- First successful poll for a source is treated as baseline and does not trigger notification.
- Regex supports plain patterns (`latest\\s+version\\s*([0-9.]+)`) or `/pattern/flags` style.

## Codebase layout

- `src/main/`: Electron main process (window, tray, polling, IPC, persistence)
- `src/preload/`: secure context bridge API
- `src/renderer/`: browser UI (TypeScript modules + HTML/CSS)
- `src/shared/`: shared TypeScript types
- `dist/`: compiled output used at runtime/package time
