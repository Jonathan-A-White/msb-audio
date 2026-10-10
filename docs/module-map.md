# msb-audio module map

Written 2026-10-10 at base commit 3c8604b (main). A docs-only story: no source file was moved or changed. It follows the factory's rule "Draw the boundaries so two stories can change two modules at once" (the PWA guide's Modular Boundaries chapter) and its library rules (the Library Best Practices guide). Every path in backticks below exists in the repo; planned files that do not exist yet are written without backticks and marked (new).

The app is small: 1,865 lines under `src/` in 16 files, 66 books, no backend. It has three code layers and nothing between them: components (screens), two hooks, and three files in `src/lib/`. The factory runs two stories of one rig in parallel only when they touch different files, so the question for each file is "how many different kinds of story edit it".

Sections: [Modules](#modules), [Collisions](#collisions), [Proposed refactors](#proposed-refactors), [Rule breaks](#rule-breaks), [Library candidates](#library-candidates).

## Modules

Line counts are `wc -l` at the base commit. "Imports" lists the repo's own modules only (npm packages are named separately).

| Module | One responsibility | Entry file and exported API | Imports |
| --- | --- | --- | --- |
| Boot | Mount the React tree into the page | `src/main.tsx` (no exports; 10 lines) | `src/App.tsx`, `src/index.css` |
| App shell | Wire the two hooks to the three components and lay out the page | `src/App.tsx` (`App`; 60 lines) | `src/components/Header.tsx`, `src/components/BulkActions.tsx`, `src/components/BookList.tsx`, `src/hooks/useDirectoryHandle.ts`, `src/hooks/useDownload.ts`, `src/App.css` |
| Header screen | Show the title, the chosen-folder button and the unsupported-browser alert | `src/components/Header.tsx` (`Header`; 48 lines) | nothing |
| Bulk actions screen | Show the 3-step hint, the Scan & Import / Pick Files Instead / Refresh Status buttons and the import progress | `src/components/BulkActions.tsx` (`BulkActions`; 89 lines) | `src/lib/downloadManager.ts` (type `BulkProgress` only), `src/lib/downloadState.ts` (`countByStatus`, type `AllDownloadState`) |
| Book list screen | Show the Old and New Testament sections as collapsible lists | `src/components/BookList.tsx` (`BookList`; 72 lines) | `src/components/BookRow.tsx`, `src/data/books.ts` (`otBooks`, `ntBooks`), `src/lib/downloadState.ts` (`getBookState`) |
| Book row screen | Show one book: number, name, status badge, progress bar, error and the Download button | `src/components/BookRow.tsx` (`BookRow`; 63 lines) | `src/data/books.ts` (type), `src/lib/downloadState.ts` (type) |
| Folder hook | Hold the chosen root folder handle in React state, restoring it on load | `src/hooks/useDirectoryHandle.ts` (`useDirectoryHandle()` returns `handle, directoryName, isSupported, isLoading, error, pick, clear`; 67 lines) | `src/lib/fileSystem.ts` |
| Download hook | Own all import and sync behaviour: pick or scan files, import each into the folder, reconcile status with the disk, cancel | `src/hooks/useDownload.ts` (`useDownload(rootHandle)` returns `state, bulkProgress, isBulkImporting, isSyncing, lastScanCount, openBookInBrowser, importSingle, importFiles, scanAndImport, syncWithFileSystem, cancelBulk`; 267 lines) | `src/data/books.ts`, `src/lib/downloadState.ts`, `src/lib/downloadManager.ts`, `src/lib/fileSystem.ts` |
| Download manager | A grab-bag: MP3 validation, filename matching, "open in Chrome", importing a file into the folder, and a fetch-based downloader with CORS proxies and retries | `src/lib/downloadManager.ts` (exports `isValidMp3`, `matchBookFromFilename`, `importBookFromData`, `openInBrowser`, `downloadBook`, `downloadBulk`, `fetchWithFallback`, `CORS_PROXIES`, types `DownloadProgress`, `DownloadResult`, `BulkProgress`; 434 lines) | `src/data/books.ts`, `src/lib/fileSystem.ts` |
| Download state | Per-book status (not started, downloading, complete, error) and its persistence in localStorage | `src/lib/downloadState.ts` (`loadState`, `saveState`, `setBookStatus`, `getBookState`, `countByStatus`, types; 83 lines) | `src/data/books.ts`; the browser's localStorage |
| File system | Everything that touches the File System Access API: the saved folder handle, finding the Bible-level folder, writing a file, scanning for books and MP3s, the file pickers | `src/lib/fileSystem.ts` (`isFileSystemAccessSupported`, `pickDirectory`, `getSavedDirectoryHandle`, `clearSavedHandle`, `invalidateBibleDirCache`, `getBookDirectory`, `writeFile`, `scanExistingBooks`, `pickMp3File`, `pickMp3Files`, `scanForMp3Files`; 193 lines) | npm `idb-keyval`; the browser's File System Access API |
| Book catalogue | The 66 books (number, abbreviation, name, testament) plus the derived URL, folder name and file name | `src/data/books.ts` (`books`, `otBooks`, `ntBooks`, `getBook`, types `Book`, `BookWithDerived`; 107 lines) | nothing |
| Platform types | Type declarations for the File System Access API that the TypeScript DOM lib lacks | `src/types/file-system.d.ts` (28 lines, ambient) | nothing |
| Styles | All visual styling | `src/App.css` (297 lines, one file for every component), `src/index.css` (46 lines, global) | nothing |

Outside `src/`: `vite.config.ts` holds the PWA manifest and service-worker settings; `public/icons` holds the icons; `tests/unit` holds four test files (`tests/unit/downloadManager.test.ts` 375 lines, `tests/unit/downloadState.test.ts` 119, `tests/unit/books.test.ts` 81, `tests/unit/fileSystem.test.ts` 90) and `tests/e2e/app.spec.ts` (65, Playwright, not in the gate). There is no unit test for either hook or any component.

Dead code (checked by grep over `src/` and `tests/` at the base commit): since the "Replace fetch-based downloads with Chrome download + file import" commit, the UI never calls `downloadBook`, `downloadBulk`, `fetchWithFallback` or `CORS_PROXIES`; only `tests/unit/downloadManager.test.ts` does. `importSingle` and `pickMp3File` are built but never wired to a button; `clear` from `useDirectoryHandle` and `getBook` are never called by the app (`getBook` only by its test). About 320 of the 434 lines of `src/lib/downloadManager.ts` (lines 26 to 58, 77 to 87 and 99 to 376) and about 300 of the 375 test lines (lines 73 to 375) serve code the app does not run.

Dependency picture: components import only `src/lib/downloadState.ts`, `src/lib/downloadManager.ts` (a type) and `src/data/books.ts`; hooks import `src/lib/*`; `src/lib/*` imports `src/data/books.ts`. Nothing imports upward. There are no cycles.

## Collisions

Command, run at the story's base commit 3c8604b (the last commit on main is dated 2026-03-20; the run date is 2026-10-10):

```
git log --since=30.days --name-only --format= -- src | sort | uniq -c | sort -rn | head -15
```

Output: empty. No commit touched `src/` in the 30 days before this run, so the 30-day list has no files. The repo is dormant, not clean.

Because the 30-day list is empty, this is the same command over all history (30 commits, 2026-03-02 to 2026-03-20), which is what the app's whole life says about where stories collide. Merge commits list no files, so the counts are commits that changed the file:

```
git log --name-only --format= -- src | sort | uniq -c | sort -rn | head -15
```

| Commits | File | Lines now |
| ---: | --- | ---: |
| 9 | `src/lib/fileSystem.ts` | 193 |
| 8 | `src/lib/downloadManager.ts` | 434 |
| 5 | `src/hooks/useDownload.ts` | 267 |
| 5 | `src/components/BulkActions.tsx` | 89 |
| 5 | `src/App.tsx` | 60 |
| 3 | `src/components/BookRow.tsx` | 63 |
| 3 | `src/components/BookList.tsx` | 72 |
| 3 | `src/App.css` | 297 |
| 2 | `src/types/file-system.d.ts` | 28 |
| 2 | `src/data/books.ts` | 107 |
| 1 | `src/vite-env.d.ts` | 1 |
| 1 | `src/main.tsx` | 10 |
| 1 | `src/lib/downloadState.ts` | 83 |
| 1 | `src/index.css` | 46 |
| 1 | `src/hooks/useDirectoryHandle.ts` | 67 |

Reading it: the stories that collided were all about one thing, getting audio onto an Android folder reliably (stale handles, picker versus scan, sync). That work lands in three files at once (`src/lib/fileSystem.ts`, `src/lib/downloadManager.ts`, `src/hooks/useDownload.ts`) plus the two files that show it (`src/components/BulkActions.tsx`, `src/App.tsx`). `src/lib/downloadManager.ts` is the nearest to the guide's 500-line trigger. Any two future stories of the "make import more reliable" kind will conflict in the top three files.

## Proposed refactors

Ranked by how much parallel work each frees. Each is a no-behaviour-change refactor. "Size" is whether it fits one story. Order matters only where stated. All new files are marked (new).

### R1. Split the file system module by concern (frees the most-collided file)

**Responsibility to carve out:** `src/lib/fileSystem.ts` mixes four things: keeping the chosen folder (idb-keyval + permission), knowing the Bible folder layout (Books, Audio, Bible, numbered book folders), writing a file safely, and picking or scanning MP3 files. Today a stale-handle fix and a new-picker story both edit it (9 commits).

**New module and API:** a folder src/storage/ (new) with an entry file src/storage/index.ts (new) that re-exports:

```ts
// src/storage/folderHandle.ts (new)
export function isFileSystemAccessSupported(): boolean;
export function pickDirectory(): Promise<FileSystemDirectoryHandle>;
export function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null>;
export function clearSavedHandle(): Promise<void>;

// src/storage/bibleLayout.ts (new): the only file that knows the on-device folder names
export function getBookDirectory(root: FileSystemDirectoryHandle, folderName: string): Promise<FileSystemDirectoryHandle>;
export function scanExistingBooks(root: FileSystemDirectoryHandle, expected: ReadonlyArray<{ number: number; folderName: string; fileName: string }>): Promise<Set<number>>;
export function invalidateBibleDirCache(root: FileSystemDirectoryHandle): void;

// src/storage/writeFile.ts (new)
export function writeFile(dir: FileSystemDirectoryHandle, fileName: string, data: Uint8Array): Promise<void>;

// src/storage/pickers.ts (new)
export function pickMp3File(): Promise<File>;
export function pickMp3Files(): Promise<File[]>;
export function scanForMp3Files(root: FileSystemDirectoryHandle): Promise<File[]>;
```

**Files it touches:** `src/lib/fileSystem.ts` (deleted, content moved), `src/hooks/useDirectoryHandle.ts` and `src/hooks/useDownload.ts` and `src/lib/downloadManager.ts` (import lines only), `tests/unit/fileSystem.test.ts` (import line only). Do this one first: R2 builds on it.

**Risk:** low. It is a pure move; the module-level WeakMap cache in bibleLayout.ts (new) must stay a single instance. The existing `tests/unit/fileSystem.test.ts` covers `getBookDirectory` only; run the gate and the e2e spec.

**Size:** fits one story.

### R2. Split the download manager by concern and remove the duplicated write-with-retry

**Responsibility to carve out:** `src/lib/downloadManager.ts` holds (a) MP3 validation, (b) filename-to-book matching, (c) saving a validated file into the book folder with a stale-handle retry (the same 20-line loop is written twice, in `downloadBookOnce` and `importBookFromData`), (d) opening a URL in Chrome, and (e) a fetch downloader the app no longer runs.

**New module and API:**

```ts
// src/import/mp3.ts (new)
export const MIN_MP3_SIZE: number;
export function isValidMp3(data: Uint8Array): boolean;
export type Mp3Check = { ok: true } | { ok: false; error: string };
export function checkMp3(data: Uint8Array): Mp3Check;

// src/import/matchBook.ts (new)
export function matchBookFromFilename(filename: string): BookWithDerived | undefined;

// src/storage/saveBookFile.ts (new): the one stale-handle retry loop
export function saveBookFile(root: FileSystemDirectoryHandle, book: BookWithDerived, data: Uint8Array): Promise<DownloadResult>;

// src/import/importBook.ts (new): validate, then save
export function importBookFromData(data: Uint8Array, book: BookWithDerived, root: FileSystemDirectoryHandle): Promise<DownloadResult>;
```

and `openInBrowser(url: string): void` moves next to the Download button's hook. The fetch downloader (`downloadBook`, `downloadBulk`, `fetchWithFallback`, `CORS_PROXIES` and their 300 test lines) is dead; deleting it is a separate decision for the Governor (it removes two third-party proxy URLs and a feature the spec once described), so it is not part of this refactor.

**Files it touches:** `src/lib/downloadManager.ts` (shrinks, then goes), `src/hooks/useDownload.ts` and `src/components/BulkActions.tsx` (imports), `tests/unit/downloadManager.test.ts` (tests move with their functions).

**Risk:** medium. The two retry loops differ only in names but their tests are on the dead path; add a test for `saveBookFile` (stale handle then success) first. Do after R1.

**Size:** fits one story. The dead-code deletion is a second, smaller story.

### R3. Split the download hook into an import pipeline and a disk sync

**Responsibility to carve out:** `src/hooks/useDownload.ts` has the same 30-line "for each matched file: mark downloading, import, mark complete or error" loop three times (`importSingle`, `importFiles`, `scanAndImport`), the same "match files to books" loop twice, and the sync reconciliation logic inside a state updater. A story that adds a new import source (for example a share target) and a story that changes sync both edit it.

**New module and API:**

```ts
// src/import/useImport.ts (new): the one pipeline
export interface UseImportReturn {
  bulkProgress: BulkProgress | null;
  isBulkImporting: boolean;
  lastScanCount: number | null;
  importFiles: () => Promise<void>;     // picker source
  scanAndImport: () => Promise<void>;   // scan source
  cancelBulk: () => void;
}
export function useImport(root: FileSystemDirectoryHandle | null, setStatus: StatusSetter): UseImportReturn;

// src/import/runImport.ts (new): pure of React, testable
export type ImportSource = () => Promise<File[]>;
export function runImport(files: File[], root: FileSystemDirectoryHandle, hooks: {
  onStart(book: BookWithDerived, index: number, total: number): void;
  onResult(book: BookWithDerived, result: DownloadResult): void;
  signal: AbortSignal;
}): Promise<void>;

// src/sync/useSync.ts (new)
export function useSync(root: FileSystemDirectoryHandle | null, state: AllDownloadState, replace: (s: AllDownloadState) => void): { isSyncing: boolean; syncWithFileSystem: () => Promise<void> };
```

**Files it touches:** `src/hooks/useDownload.ts` (becomes a thin composer or goes), `src/App.tsx` (hook wiring), a new test file for `runImport`. The unwired `importSingle` is dropped or becomes a third source of `runImport`.

**Risk:** medium. The hook has no unit test today; write `runImport` tests (success, invalid MP3, abort mid-way) before moving code. React StrictMode runs state updaters twice; keep the status writes out of the updater (see R4).

**Size:** fits one story (about 270 lines moved, 100 removed by de-duplication).

### R4. Make download state pure and put persistence behind one store

**Responsibility to carve out:** `src/lib/downloadState.ts` writes to localStorage inside `setBookStatus`, and `src/hooks/useDownload.ts` calls `saveState` inside a React state updater (a side effect in a function React may run twice). The "reconcile status with the disk" rule lives in the hook.

**New module and API:**

```ts
// src/status/statusStore.ts (new)
export interface StatusStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function createStatusStore(storage: StatusStorage, key?: string): {
  load(): AllDownloadState;
  save(state: AllDownloadState): void;
};

// src/status/status.ts (new): pure, no storage, no React
export function markBook(state: AllDownloadState, n: number, status: DownloadStatus, progress?: number, error?: string): AllDownloadState;
export function reconcileWithDisk(state: AllDownloadState, onDisk: ReadonlySet<number>, bookNumbers: readonly number[]): AllDownloadState;
export function countByStatus(state: AllDownloadState, bookNumbers: readonly number[]): Record<DownloadStatus, number>;
```

**Files it touches:** `src/lib/downloadState.ts` (replaced), `src/hooks/useDownload.ts`, `src/components/BulkActions.tsx`, `src/components/BookList.tsx`, `src/components/BookRow.tsx` (imports), `tests/unit/downloadState.test.ts`.

**Risk:** low to medium: the stored JSON shape and the key name `msb-audio-download-state` must not change or users lose their status. Do after R3 or inside it.

**Size:** fits one story.

### R5. Separate the book catalogue from the audio source and the on-device layout

**Responsibility to carve out:** `src/data/books.ts` holds the canon list and also the audio source (the base URL on openbible.com and the file name pattern MSB_NN_Abbr.mp3) and the device folder name (NN-Name). The translation "MSB", the count 66, the URL and the folder/file regexes are constants spread over `src/data/books.ts`, `src/lib/downloadManager.ts`, `src/lib/fileSystem.ts` and `src/components/BulkActions.tsx`. A second translation or source would be an edit to all four.

**New module and API:**

```ts
// src/catalogue/books.ts (new): facts only
export interface Book { number: number; abbr: string; name: string; testament: 'OT' | 'NT' }
export const BOOKS: readonly Book[];
export const TOTAL_BOOKS: number;           // BOOKS.length, replaces the literal 66

// src/source/audioSource.ts (new)
export interface AudioSource {
  id: string;                                // 'msb'
  urlFor(book: Book): string;
  fileNameFor(book: Book): string;
  matchFileName(name: string): number | undefined;   // book number
}
export const msbOpenBible: AudioSource;

// src/storage/layout.ts (new)
export interface FolderLayout { folderNameFor(book: Book): string; libraryPath: readonly string[] }
export const defaultLayout: FolderLayout;
```

**Files it touches:** `src/data/books.ts`, `src/lib/downloadManager.ts`, `src/lib/fileSystem.ts`, `src/components/BulkActions.tsx`, `src/components/BookList.tsx`, `src/components/BookRow.tsx`, `tests/unit/books.test.ts`.

**Risk:** medium: touches many files, so do it after R1 to R3. Output paths and file names must stay byte-identical (the spec says an existing player app reads that tree).

**Size:** fits one story, but only just; the AudioSource part can be a second story.

### R6. Split App.css by component

**Responsibility to carve out:** `src/App.css` (297 lines) is edited by every UI story (3 commits), and parts of it are unused (`.bulk-again`, `.btn-bulk-again` and `.btn-import` have no user in `src/`).

**New module and API:** one stylesheet beside each component, imported by that component only: src/components/Header.css, src/components/BulkActions.css, src/components/BookList.css, src/components/BookRow.css (all new), with shared button and alert rules in src/styles/base.css (new). No code API.

**Files it touches:** `src/App.css` (deleted), the four component files (one import line each), `src/App.tsx` (drops the import).

**Risk:** low, but CSS order decides ties; keep `.btn` rules in the base file imported first, and check the screens at phone width.

**Size:** fits one story.

### R7. Let screens read state from a provider instead of 10 props through App

**Responsibility to carve out:** `src/App.tsx` (5 commits) exists mostly to hand `useDownload`'s return value to `src/components/BulkActions.tsx` as ten props. Every new action adds a line to App, to the props interface and to the component.

**New module and API:**

```ts
// src/state/DownloadProvider.tsx (new)
export function DownloadProvider(props: { children: React.ReactNode }): JSX.Element;
export function useDownloads(): UseDownloadReturn & { directory: UseDirectoryHandleReturn };
```

Components call `useDownloads()` for what they need; `src/App.tsx` becomes layout only.

**Files it touches:** `src/App.tsx`, `src/main.tsx`, `src/components/Header.tsx`, `src/components/BulkActions.tsx`, `src/components/BookList.tsx`.

**Risk:** medium: the e2e spec is the only screen test; add component tests as you go. Do last, after R3 and R4 have settled what the provider holds.

**Size:** fits one story.

### Order and parallelism

R1 then R2 (R2's `saveBookFile` lives in the storage folder R1 creates). R3 can run beside R2 (they share only import lines). R4 beside R1 or R2. R5 after R1 to R3. R6 can run at any time, alongside anything, since no refactor above edits CSS. R7 last. After R1 to R3 a "new import source" story touches only a new source file plus one line in the import hook, and a "stale-handle fix" story touches only the storage folder.

## Rule breaks

Against the PWA guide's Modular Boundaries chapter and the Library Best Practices:

1. **A screen reaches into a logic module, not an interface.** `src/components/BulkActions.tsx` imports a type from `src/lib/downloadManager.ts`, a file that also holds the network and file-system code, and calls `countByStatus` from `src/lib/downloadState.ts`; `src/components/BookList.tsx` imports the catalogue arrays directly from `src/data/books.ts`. No screen calls a vendor (no fetch, no File System Access call, no localStorage in `src/components/`), so the worst form of the break is absent. R2, R4 and R5 close the rest.
2. **Constants where the guide wants data or settings.** The translation and source are constants: the openbible.com base URL and the MSB_NN pattern in `src/data/books.ts`, the regexes `^MSB_(\d{2})_` in `src/lib/downloadManager.ts` and `^MSB_\d{2}_` in `src/lib/fileSystem.ts`, the app title in `src/components/Header.tsx`. The literal `66` in `src/components/BulkActions.tsx` (line 64) repeats the catalogue length. The folder names "Books", "Audio" and "Bible" and the numbered-folder regex live in `src/lib/fileSystem.ts`, while the spec says another player app owns that layout. R5 fixes these.
3. **Duplicate code inside the app.** The stale-handle write-and-retry loop appears twice in `src/lib/downloadManager.ts`; the per-file import loop appears three times and the file-matching loop twice in `src/hooks/useDownload.ts`; `formatNumber` in `src/components/BookRow.tsx` repeats `padNumber` in `src/data/books.ts`. R2 and R3 fix these.
4. **A side effect hidden in a pure-looking function.** `setBookStatus` in `src/lib/downloadState.ts` saves to localStorage, and `src/hooks/useDownload.ts` calls `saveState` inside a state updater. R4 fixes this.
5. **A vendor wired without an interface.** `src/lib/downloadManager.ts` names two third-party proxy services (corsproxy.io, allorigins.win) in code; the app no longer runs that path, so deleting it (see R2) removes the break.
6. **A second copy of shared data.** The 66-book list is also in Lampas (its files src/data/books.ts and src/data/otBooks.ts): see Library candidates.
7. **Duplicate of bsv-kit code: none found.** msb-audio imports nothing from bsv-kit and holds no signing, key store, licence gate or mill client of its own. It has no settings store, no event bus and no repository layer; for an app this size that is not yet a break, and the Folder hook is its one setting.
8. **Nothing personal in the code: clean.** No keys, addresses or owner word lists were found in `src/`, `public/` or `vite.config.ts`.

## Library candidates

Per the library rules: a second copy is the signal; a piece that is plainly shareable may be lifted before the second copy; a library is public, holds nothing personal, and starts at 0.1.0 with a README example, a CHANGELOG that names each breaking change with its migration, tests in CI, a licence and a pinned tag.

1. **The Bible canon list: a new public library, `bible-books`.** A real second copy exists: Lampas keeps the 27 New Testament books in its file src/data/books.ts and the 39 Old Testament books in its file src/data/otBooks.ts, and msb-audio keeps all 66 in `src/data/books.ts`. Proposed public API (pure data, no DOM, no storage):

   ```ts
   export interface CanonBook { number: number; code: string; name: string; testament: 'OT' | 'NT'; chapters: number }
   export const CANON: readonly CanonBook[];            // 66 books, Protestant order
   export function bookByNumber(n: number): CanonBook | undefined;
   export function bookByCode(code: string): CanonBook | undefined;
   ```

   Source-specific naming (the MSB file abbreviations, Logos abbreviations) stays in each app as a small map keyed by `number`. Versioning: 0.1.0 first. A renamed or removed export, or a changed `code` or `number` for any book, is breaking (a minor bump while 0.x, a major from 1.0). Adding a field is a minor change. Chapter counts differ by tradition, so state the Protestant canon in the README; a different canon is a new export, not a changed one.

2. **File System Access helpers: a new public library, `fsa-folder`.** Worth lifting before a second app copies it, because the stale-handle lessons cost this app several commits. Parts: keeping a chosen folder across sessions with the permission re-request, writing a file without leaving an empty file on error, and a retry that recognises Android Chrome's stale-handle error. Proposed API (no Bible knowledge in it; the app passes the path and names):

   ```ts
   export interface FolderStore { pick(): Promise<FileSystemDirectoryHandle>; restore(): Promise<FileSystemDirectoryHandle | null>; clear(): Promise<void> }
   export function createFolderStore(opts: { key: string; storage?: KeyValueStore }): FolderStore;
   export function ensurePath(root: FileSystemDirectoryHandle, segments: readonly string[]): Promise<FileSystemDirectoryHandle>;
   export function writeFileSafely(dir: FileSystemDirectoryHandle, name: string, data: Uint8Array): Promise<void>;
   export function withStaleHandleRetry<T>(op: () => Promise<T>, opts?: { attempts?: number; onStale?: () => void }): Promise<T>;
   export function isFileSystemAccessSupported(env?: object): boolean;
   ```

   It is a browser library (it needs the File System Access API), so unlike bsv-kit's no-DOM packages it must say so in its README and take the browser objects as arguments where it can, to keep tests simple. Versioning: 0.1.0; changing the storage key format or the error it treats as stale is breaking, because an app's saved folder would be lost. Lift it after R1 and R2, so the code comes out of the app already shaped like the API. Only one app uses it today, so the Mayor may prefer to wait for a second user; the guide allows lifting early.

3. **Adopt, not lift: one-time tips from bsv-kit.** The permanent 3-step hint in `src/components/BulkActions.tsx` could use `@bsv-kit/tips` (a list of one-time tips with dismissal through an injected storage). This is adopting an existing library, not creating one; it needs the allowScripts and commit-pin steps from the versioning rules, and it would add a dependency to an app that has none from bsv-kit, so it is a product choice for the Governor, not a refactor.

4. **Not candidates.** The status store (R4) is specific to this app's four statuses; the fetch-with-proxy downloader is dead code, and a library of unused code should not be published; MP3 validation (`isValidMp3`, about 15 lines) is too small to be a library by itself and can join `fsa-folder` or stay here until a second app needs it.
