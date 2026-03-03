import { useState, useCallback, useRef } from 'react';
import type { BookWithDerived } from '../data/books';
import {
  type AllDownloadState,
  loadState,
  setBookStatus,
} from '../lib/downloadState';
import {
  openInBrowser,
  importBookFromData,
  matchBookFromFilename,
  type BulkProgress,
} from '../lib/downloadManager';
import { pickMp3File, pickMp3Files } from '../lib/fileSystem';

interface UseDownloadReturn {
  state: AllDownloadState;
  bulkProgress: BulkProgress | null;
  isBulkImporting: boolean;
  openBookInBrowser: (book: BookWithDerived) => void;
  importSingle: (book: BookWithDerived) => Promise<void>;
  importFiles: () => Promise<void>;
  cancelBulk: () => void;
}

export function useDownload(
  rootHandle: FileSystemDirectoryHandle | null
): UseDownloadReturn {
  const [state, setState] = useState<AllDownloadState>(loadState);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
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

  const cancelBulk = useCallback(() => {
    bulkAbortRef.current?.abort();
  }, []);

  return {
    state,
    bulkProgress,
    isBulkImporting,
    openBookInBrowser,
    importSingle,
    importFiles,
    cancelBulk,
  };
}
