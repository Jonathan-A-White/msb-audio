# msb-audio — Spec

A PWA download manager for Majority Standard Bible (MSB) audio files from [openbible.com/audio/msb_books/](https://openbible.com/audio/msb_books/). Downloads MP3s directly to device storage in a folder structure compatible with an existing audio Bible player app.

## Overview

- **What it is:** A download manager PWA. No audio playback.
- **Target platform:** Android Chrome only (relies on File System Access API).
- **Source:** 66 hardcoded MP3 files from `https://openbible.com/audio/msb_books/`.
- **No local cache.** Files stream directly from the server to device storage. "Download again" always re-fetches from the server.

## Tech Stack

- React + Vite
- TypeScript
- Vitest for unit/integration tests
- Playwright for e2e/BDD tests
- GitHub Pages for hosting
- GitHub Actions for CI/CD (lint, test, build, deploy)

## Folder Structure (Output on Device)

The user picks a root directory via the File System Access API directory picker. Inside that directory, the app creates:

```
<user-chosen-root>/
  Books/
    Audio/
      Bible/
        01-Genesis/
          MSB_01_Gen.mp3
        02-Exodus/
          MSB_02_Exo.mp3
        ...
        49-Ephesians/
          MSB_49_Eph.mp3
        ...
        66-Revelation/
          MSB_66_Rev.mp3
```

If the user picks a directory that already contains `Books/Audio/Bible/`, the app should use the existing path rather than nesting it.

## Data Model

All 66 books are hardcoded. Each book has:

| Field        | Example          | Notes                                |
|------------- |----------------- |------------------------------------- |
| `number`     | `49`             | 1–66, canonical order                |
| `abbr`       | `Eph`            | As used in the MP3 filename          |
| `name`       | `Ephesians`      | Full book name for the folder        |
| `testament`  | `NT`             | `OT` (1–39) or `NT` (40–66)         |
| `url`        | (derived)        | `https://openbible.com/audio/msb_books/MSB_49_Eph.mp3` |
| `folderName` | (derived)        | `49-Ephesians`                       |
| `fileName`   | (derived)        | `MSB_49_Eph.mp3`                    |

## Download State Tracking

The app tracks which books have been downloaded using `localStorage`. State per book:

| State          | Meaning                                                  |
|--------------- |--------------------------------------------------------- |
| `not_started`  | Never downloaded                                         |
| `downloading`  | Currently in progress (with progress percentage)         |
| `complete`     | Successfully downloaded to device storage                |
| `error`        | Download failed (store error message for display)        |

**Important:** The download state is best-effort. Since we have no local cache and the user can delete files outside the app, "complete" means "the app successfully wrote the file at some point." The "Download again" option exists for exactly this reason.

On first load or when no state exists, all books default to `not_started`.

## User Flows

### First Launch

1. User opens the PWA.
2. App displays all 66 books grouped by testament (OT / NT), all showing `not_started`.
3. Before any download, the user must pick a root directory via the File System Access API directory picker. A prominent "Choose Download Folder" button appears at the top.
4. Once a folder is selected, download controls become active.

### Picking the Root Directory

1. User taps "Choose Download Folder."
2. The File System Access API `showDirectoryPicker()` opens.
3. User navigates to/creates their desired root folder.
4. The app stores the directory handle (in IndexedDB, since `FileSystemDirectoryHandle` is not serializable to localStorage) so the user doesn't have to re-pick every time.
5. On subsequent visits, the app tries to re-acquire the stored handle. If permission has been revoked, it prompts the user to re-pick.

### Downloading Individual Books

1. Each book row shows a download button (if `not_started` or `error`) or a "Download Again" button (if `complete`).
2. On tap, the app:
   a. Creates the folder path `Books/Audio/Bible/<NN-BookName>/` inside the root directory if it doesn't exist.
   b. Fetches the MP3 from the source URL.
   c. Writes the response stream to a file in the target folder.
   d. Shows download progress (bytes received / content-length).
   e. On success, marks the book as `complete`.
   f. On failure, marks the book as `error` with a message.
3. User can cancel an in-progress download.

### Bulk Downloads

Three bulk actions available:

- **Download All** — downloads all 66 books sequentially.
- **Download OT** — downloads books 1–39 sequentially.
- **Download NT** — downloads books 40–66 sequentially.

Bulk downloads:

- Skip books already marked `complete` (unless user explicitly chose "Download All Again" variant).
- Process one book at a time (sequential, not parallel) to avoid overwhelming the connection and to give clear progress indication.
- Can be cancelled, stopping after the current book finishes.
- Show overall progress: "Downloading 12 of 39 (Ezra)".

### Download Again

- Available per-book for any book marked `complete`.
- Re-fetches from the server and overwrites the existing file.
- Bulk "Download All Again" / "Download OT Again" / "Download NT Again" variants re-download everything regardless of current state.

## UI Design

### Layout

- **Header:** App name, "Choose Download Folder" button showing the currently selected path (or prompt if none selected).
- **Bulk actions bar:** "Download All" / "Download OT" / "Download NT" buttons. Disabled until a folder is selected.
- **Book list:** Two sections — "Old Testament" and "New Testament" — each with a collapsible list of books.

### Per-Book Row

- Book number and full name (e.g., "49 — Ephesians").
- Status indicator: icon or badge showing state.
- Progress bar (visible during download).
- Action button: "Download" / "Downloading… (cancel)" / "Download Again".

### Responsiveness

- Mobile-first. Full width single-column layout.
- Touch targets at least 48px.
- Works well on phone screens (360px+).

### Offline

- The PWA shell itself (HTML/CSS/JS) should be cached by the service worker so the app loads offline.
- Downloads obviously require network, but the UI should load and show cached download state even offline.

## Edge Cases & Error Handling

### File System Access API

- **API not supported:** Show a clear message: "This app requires Chrome on Android. File System Access API is not available in your browser."
- **Permission denied / dismissed:** Show message, allow retry.
- **Permission revoked between sessions:** Detect on app load, prompt user to re-select folder.
- **Directory handle becomes stale:** Handle gracefully, prompt re-selection.

### Downloads

- **Network failure mid-download:** Mark as `error`, clean up partial file if possible, allow retry.
- **Server returns non-200:** Mark as `error` with status code context.
- **Content-Length header missing:** Download still works, just show indeterminate progress.
- **Device storage full:** Catch the write error, mark as `error` with "Storage full" message.
- **User closes app mid-download:** On next open, any book stuck in `downloading` state should be reset to `not_started` (or `error`).
- **Slow/metered connection:** No special handling required, but downloads are sequential to be connection-friendly.
- **CORS:** The openbible.com server must allow cross-origin requests. If it doesn't, document this as a known limitation and suggest a CORS proxy as a workaround. Verify during development.

### State

- **localStorage cleared:** App resets to all `not_started`. This is acceptable — the user can re-download or just use "Download Again" for specific books.
- **Multiple tabs:** No special handling. Warn the user if a download is detected in another tab (or just let localStorage conflicts resolve naturally — this is a single-user mobile PWA).

## Testing Strategy

### BDD (Playwright e2e)

Write behavioral scenarios covering key user flows:

```gherkin
Feature: Directory Selection
  Scenario: User selects a download directory
    Given the app is loaded
    When the user clicks "Choose Download Folder"
    And selects a directory
    Then the directory path is displayed in the header
    And download buttons become active

  Scenario: App remembers the selected directory
    Given the user previously selected a directory
    When the app is reloaded
    Then the previously selected directory is still active

  Scenario: Browser does not support File System Access API
    Given the browser does not support File System Access API
    When the app is loaded
    Then a compatibility warning is displayed
    And download buttons are disabled

Feature: Individual Download
  Scenario: Download a single book
    Given a download directory is selected
    When the user taps "Download" on "49 — Ephesians"
    Then a progress bar appears on that row
    And the file is written to Books/Audio/Bible/49-Ephesians/MSB_49_Eph.mp3
    And the status changes to "complete"

  Scenario: Download fails due to network error
    Given a download directory is selected
    When the user starts a download and the network fails
    Then the status changes to "error"
    And a retry button is available

  Scenario: Download again overwrites existing file
    Given "49 — Ephesians" is marked as complete
    When the user taps "Download Again"
    Then the file is re-fetched and overwritten

Feature: Bulk Download
  Scenario: Download all Old Testament books
    Given a download directory is selected
    When the user taps "Download OT"
    Then books 1–39 are downloaded sequentially
    And overall progress is shown
    And completed books are skipped

  Scenario: Cancel a bulk download
    Given a bulk download is in progress
    When the user taps "Cancel"
    Then the current book finishes downloading
    And no further books are started

Feature: Offline Shell
  Scenario: App loads offline
    Given the app has been visited before
    And the device is offline
    When the user opens the app
    Then the UI loads from cache
    And download states are shown from localStorage
    And download buttons show a "No connection" state
```

### TDD (Vitest unit/integration)

Test modules in isolation:

- **`books.ts`** — Book data model. Test that all 66 books are present, URLs are correctly derived, folder/file names are correct, OT/NT grouping is accurate.
- **`downloadState.ts`** — State management. Test state transitions (`not_started` → `downloading` → `complete`/`error`), persistence to/from localStorage, reset of stale `downloading` states on init, bulk state queries (how many complete in OT, etc.).
- **`fileSystem.ts`** — File system operations (mock the File System Access API). Test directory creation (nested `Books/Audio/Bible/<folder>`), file writing, handle re-acquisition, error cases (permission denied, stale handle, storage full).
- **`downloadManager.ts`** — Orchestration logic. Test sequential download behavior, skip-already-complete logic, cancellation mid-queue, progress event emission, error recovery.
- **Component tests** — Render components with various states, verify correct buttons/indicators shown, test user interactions trigger correct actions.

### Edge Case Tests

- All 66 books map correctly (no typos in abbreviations or names).
- Folder name format is always `NN-Name` with zero-padded two-digit number.
- Books with number prefixes in names (e.g., "1 Samuel" → `09-1 Samuel`) — verify the folder name doesn't cause filesystem issues. Consider using `09-1Samuel` (no space) if needed.
- State recovery after simulated crash (stale `downloading` state).
- Directory handle serialization/deserialization roundtrip.
- Download of smallest file (2.6 MB — 2 John) and largest file (377 MB — Psalms).

## CI/CD — GitHub Actions

### Workflow: `ci.yml`

Triggered on push to `main` and on pull requests.

**Jobs:**

1. **Lint** — Run ESLint and TypeScript type checking.
2. **Test** — Run Vitest (unit/integration) tests.
3. **E2E** — Run Playwright tests against a Vite preview build.
4. **Build** — `vite build` with `base: /msb-audio/` for GitHub Pages.
5. **Deploy** — On push to `main` only, deploy the `dist/` folder to GitHub Pages using `peaceiris/actions-gh-pages` or the official `actions/deploy-pages`.

### Vite Config Notes

- Set `base: '/msb-audio/'` for GitHub Pages path prefix.
- Generate a service worker (use `vite-plugin-pwa` or a simple custom one).

## Project Structure

```
msb-audio/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   ├── manifest.json
│   └── icons/              # PWA icons
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── data/
│   │   └── books.ts         # Hardcoded 66-book list
│   ├── lib/
│   │   ├── downloadState.ts  # localStorage state management
│   │   ├── fileSystem.ts     # File System Access API wrapper
│   │   └── downloadManager.ts # Download orchestration
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── BulkActions.tsx
│   │   ├── BookList.tsx
│   │   └── BookRow.tsx
│   └── hooks/
│       ├── useDirectoryHandle.ts
│       └── useDownload.ts
├── tests/
│   ├── unit/
│   │   ├── books.test.ts
│   │   ├── downloadState.test.ts
│   │   ├── fileSystem.test.ts
│   │   └── downloadManager.test.ts
│   └── e2e/
│       └── app.spec.ts       # Playwright BDD scenarios
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Out of Scope

- Audio playback of any kind.
- iOS / Safari support.
- Local caching of MP3 files within the PWA.
- Multiple audio Bible sources.
- Chapter-level downloads (source is one MP3 per book).
- User accounts or cloud sync.

## CORS Note

Verify early that `https://openbible.com/audio/msb_books/` serves responses with appropriate CORS headers (`Access-Control-Allow-Origin`). If it does not, options include:

1. A lightweight CORS proxy (e.g., Cloudflare Worker).
2. Documenting that the user must use a browser extension for local dev.

This should be the first technical spike before building UI.

## Open Questions (Resolved)

| Question | Decision |
|---|---|
| Audio player? | No — download manager only |
| File storage approach? | File System Access API, device storage |
| iOS support? | No — Android Chrome only |
| Local cache? | No — always re-fetch from server |
| Extensible to other sources? | No — MSB hardcoded |
| Tech stack? | React + Vite + TypeScript |
| Hosting? | GitHub Pages |
