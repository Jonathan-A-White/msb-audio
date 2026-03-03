import { useState, useCallback, useRef } from 'react';
import type { BookWithDerived } from '../data/books';
import { books, otBooks, ntBooks } from '../data/books';
import {
  type AllDownloadState,
  loadState,
  setBookStatus,
  getBookState,
} from '../lib/downloadState';
import {
  downloadBook,
  downloadBulk,
  type DownloadProgress,
  type BulkProgress,
} from '../lib/downloadManager';

interface UseDownloadReturn {
  state: AllDownloadState;
  bulkProgress: BulkProgress | null;
  isBulkDownloading: boolean;
  downloadSingle: (book: BookWithDerived) => Promise<void>;
  downloadAll: (redownload: boolean) => Promise<void>;
  downloadOT: (redownload: boolean) => Promise<void>;
  downloadNT: (redownload: boolean) => Promise<void>;
  cancelBulk: () => void;
  cancelSingle: (bookNumber: number) => void;
}

export function useDownload(
  rootHandle: FileSystemDirectoryHandle | null
): UseDownloadReturn {
  const [state, setState] = useState<AllDownloadState>(loadState);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const bulkAbortRef = useRef<AbortController | null>(null);
  const singleAbortRefs = useRef<Map<number, AbortController>>(new Map());

  const handleProgress = useCallback((progress: DownloadProgress) => {
    setState((prev) =>
      setBookStatus(prev, progress.bookNumber, 'downloading', progress.percent)
    );
  }, []);

  const downloadSingle = useCallback(
    async (book: BookWithDerived) => {
      if (!rootHandle) return;

      const controller = new AbortController();
      singleAbortRefs.current.set(book.number, controller);

      setState((prev) => setBookStatus(prev, book.number, 'downloading', 0));

      const result = await downloadBook(
        book,
        rootHandle,
        handleProgress,
        controller.signal
      );

      singleAbortRefs.current.delete(book.number);

      if (result.success) {
        setState((prev) => setBookStatus(prev, book.number, 'complete', 100));
      } else {
        setState((prev) =>
          setBookStatus(prev, book.number, 'error', 0, result.error)
        );
      }
    },
    [rootHandle, handleProgress]
  );

  const cancelSingle = useCallback((bookNumber: number) => {
    const controller = singleAbortRefs.current.get(bookNumber);
    if (controller) {
      controller.abort();
      singleAbortRefs.current.delete(bookNumber);
    }
  }, []);

  const startBulk = useCallback(
    async (bookList: BookWithDerived[], redownload: boolean) => {
      if (!rootHandle) return;

      const controller = new AbortController();
      bulkAbortRef.current = controller;
      setIsBulkDownloading(true);

      const completedBooks = new Set<number>();
      if (!redownload) {
        for (const book of bookList) {
          if (getBookState(state, book.number).status === 'complete') {
            completedBooks.add(book.number);
          }
        }
      }

      await downloadBulk(
        bookList,
        rootHandle,
        !redownload,
        completedBooks,
        handleProgress,
        (bp) => setBulkProgress(bp),
        (result) => {
          if (result.success) {
            setState((prev) =>
              setBookStatus(prev, result.bookNumber, 'complete', 100)
            );
          } else {
            setState((prev) =>
              setBookStatus(
                prev,
                result.bookNumber,
                'error',
                0,
                result.error
              )
            );
          }
        },
        controller.signal
      );

      setIsBulkDownloading(false);
      setBulkProgress(null);
      bulkAbortRef.current = null;
    },
    [rootHandle, state, handleProgress]
  );

  const downloadAll = useCallback(
    (redownload: boolean) => startBulk(books, redownload),
    [startBulk]
  );

  const downloadOT = useCallback(
    (redownload: boolean) => startBulk(otBooks, redownload),
    [startBulk]
  );

  const downloadNT = useCallback(
    (redownload: boolean) => startBulk(ntBooks, redownload),
    [startBulk]
  );

  const cancelBulk = useCallback(() => {
    bulkAbortRef.current?.abort();
  }, []);

  return {
    state,
    bulkProgress,
    isBulkDownloading,
    downloadSingle,
    downloadAll,
    downloadOT,
    downloadNT,
    cancelBulk,
    cancelSingle,
  };
}
