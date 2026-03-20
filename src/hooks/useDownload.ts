import { useState, useCallback, useRef, useEffect } from 'react';
import type { BookWithDerived } from '../data/books';
import { books } from '../data/books';
import {
  type AllDownloadState,
  loadState,
  setBookStatus,
  saveState,
} from '../lib/downloadState';
import {
  openInBrowser,
  importBookFromData,
  matchBookFromFilename,
  type BulkProgress,
} from '../lib/downloadManager';
import { pickMp3File, pickMp3Files, scanForMp3Files, scanExistingBooks } from '../lib/fileSystem';

interface UseDownloadReturn {
  state: AllDownloadState;
  bulkProgress: BulkProgress | null;
  isBulkImporting: boolean;
  isSyncing: boolean;
  lastScanCount: number | null;
  openBookInBrowser: (book: BookWithDerived) => void;
  importSingle: (book: BookWithDerived) => Promise<void>;
  importFiles: () => Promise<void>;
  scanAndImport: () => Promise<void>;
  syncWithFileSystem: () => Promise<void>;
  cancelBulk: () => void;
}

export function useDownload(
  rootHandle: FileSystemDirectoryHandle | null
): UseDownloadReturn {
  const [state, setState] = useState<AllDownloadState>(loadState);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastScanCount, setLastScanCount] = useState<number | null>(null);
  const bulkAbortRef = useRef<AbortController | null>(null);

  const openBookInBrowser = useCallback((book: BookWithDerived) => {
    openInBrowser(book.url);
  }, []);

  const importSingle = useCallback(
    async (book: BookWithDerived) => {
      if (!rootHandle) return;

      let file: File;
      try {
        file = await pickMp3File();
      } catch (err) {
        // User cancelled the file picker
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      }

      setState((prev) => setBookStatus(prev, book.number, 'downloading', 50));

      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const result = await importBookFromData(data, book, rootHandle);

        if (result.success) {
          setState((prev) => setBookStatus(prev, book.number, 'complete', 100));
        } else {
          setState((prev) =>
            setBookStatus(prev, book.number, 'error', 0, result.error)
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        setState((prev) =>
          setBookStatus(prev, book.number, 'error', 0, message)
        );
      }
    },
    [rootHandle]
  );

  const importFiles = useCallback(async () => {
    if (!rootHandle) return;

    let files: File[];
    try {
      files = await pickMp3Files();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }

    // Match selected files to known books by filename
    const matched: Array<{ book: BookWithDerived; file: File }> = [];
    for (const file of files) {
      const book = matchBookFromFilename(file.name);
      if (book) matched.push({ book, file });
    }

    if (matched.length === 0) return;

    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setIsBulkImporting(true);

    try {
      for (let i = 0; i < matched.length; i++) {
        if (controller.signal.aborted) break;

        const { book, file } = matched[i];
        setBulkProgress({
          currentIndex: i + 1,
          totalBooks: matched.length,
          currentBook: book,
        });

        setState((prev) => setBookStatus(prev, book.number, 'downloading', 50));

        try {
          const data = new Uint8Array(await file.arrayBuffer());
          const result = await importBookFromData(data, book, rootHandle);

          if (result.success) {
            setState((prev) => setBookStatus(prev, book.number, 'complete', 100));
          } else {
            setState((prev) =>
              setBookStatus(prev, book.number, 'error', 0, result.error)
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Import failed';
          setState((prev) =>
            setBookStatus(prev, book.number, 'error', 0, message)
          );
        }
      }
    } finally {
      setIsBulkImporting(false);
      setBulkProgress(null);
      bulkAbortRef.current = null;
    }
  }, [rootHandle]);

  const scanAndImport = useCallback(async () => {
    if (!rootHandle) return;

    setLastScanCount(null);

    // Scan the root folder for MSB MP3 files — no file picker needed
    let files: File[];
    try {
      files = await scanForMp3Files(rootHandle);
    } catch (err) {
      console.error('[scan] failed to scan directory:', err);
      return;
    }

    // Match found files to known books
    const matched: Array<{ book: BookWithDerived; file: File }> = [];
    for (const file of files) {
      const book = matchBookFromFilename(file.name);
      if (book) matched.push({ book, file });
    }

    setLastScanCount(matched.length);
    if (matched.length === 0) return;

    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setIsBulkImporting(true);

    try {
      for (let i = 0; i < matched.length; i++) {
        if (controller.signal.aborted) break;

        const { book, file } = matched[i];
        setBulkProgress({
          currentIndex: i + 1,
          totalBooks: matched.length,
          currentBook: book,
        });

        setState((prev) => setBookStatus(prev, book.number, 'downloading', 50));

        try {
          const data = new Uint8Array(await file.arrayBuffer());
          const result = await importBookFromData(data, book, rootHandle);

          if (result.success) {
            setState((prev) => setBookStatus(prev, book.number, 'complete', 100));
          } else {
            setState((prev) =>
              setBookStatus(prev, book.number, 'error', 0, result.error)
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Import failed';
          setState((prev) =>
            setBookStatus(prev, book.number, 'error', 0, message)
          );
        }
      }
    } finally {
      setIsBulkImporting(false);
      setBulkProgress(null);
      bulkAbortRef.current = null;
    }
  }, [rootHandle]);

  const syncWithFileSystem = useCallback(async () => {
    if (!rootHandle) return;

    setIsSyncing(true);
    try {
      const existingBooks = await scanExistingBooks(rootHandle, books);

      setState((prev) => {
        const newState = { ...prev };
        for (const book of books) {
          const current = prev[book.number];
          if (existingBooks.has(book.number)) {
            // File exists on disk — mark complete if it wasn't already
            if (!current || current.status !== 'complete') {
              newState[book.number] = { status: 'complete', progress: 100 };
            }
          } else {
            // File missing — if we thought it was complete, reset
            if (current?.status === 'complete') {
              newState[book.number] = { status: 'not_started', progress: 0 };
            }
          }
        }
        saveState(newState);
        return newState;
      });
    } catch (err) {
      console.error('[sync] failed to sync with filesystem:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [rootHandle]);

  // Auto-sync when a directory handle becomes available
  useEffect(() => {
    if (rootHandle) {
      syncWithFileSystem();
    }
  }, [rootHandle, syncWithFileSystem]);

  const cancelBulk = useCallback(() => {
    bulkAbortRef.current?.abort();
  }, []);

  return {
    state,
    bulkProgress,
    isBulkImporting,
    isSyncing,
    lastScanCount,
    openBookInBrowser,
    importSingle,
    importFiles,
    scanAndImport,
    syncWithFileSystem,
    cancelBulk,
  };
}
