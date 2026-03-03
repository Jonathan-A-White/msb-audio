import type { BookWithDerived } from '../data/books';
import { getBookDirectory, writeFile } from './fileSystem';

export interface DownloadProgress {
  bookNumber: number;
  loaded: number;
  total: number;
  percent: number;
}

export interface DownloadResult {
  bookNumber: number;
  success: boolean;
  error?: string;
}

export interface BulkProgress {
  currentIndex: number;
  totalBooks: number;
  currentBook: BookWithDerived;
}

export async function downloadBook(
  book: BookWithDerived,
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<DownloadResult> {
  try {
    const response = await fetch(book.url, { signal: abortSignal });

    if (!response.ok) {
      return {
        bookNumber: book.number,
        success: false,
        error: `Server returned ${response.status} ${response.statusText}`,
      };
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      return {
        bookNumber: book.number,
        success: false,
        error: 'Response body is empty',
      };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    let done = false;

    while (!done) {
      if (abortSignal?.aborted) {
        reader.cancel();
        return {
          bookNumber: book.number,
          success: false,
          error: 'Download cancelled',
        };
      }

      const result = await reader.read();
      done = result.done ?? false;
      const value = result.value;
      if (done || !value) break;

      chunks.push(value);
      loaded += value.length;

      const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgress({ bookNumber: book.number, loaded, total, percent });
    }

    // Combine chunks into single array
    const data = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    // Write to file system
    const bookDir = await getBookDirectory(rootHandle, book.folderName);
    await writeFile(bookDir, book.fileName, data);

    return { bookNumber: book.number, success: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        bookNumber: book.number,
        success: false,
        error: 'Download cancelled',
      };
    }

    const message =
      err instanceof Error ? err.message : 'Unknown error';

    // Detect storage full errors
    if (message.includes('quota') || message.includes('storage')) {
      return {
        bookNumber: book.number,
        success: false,
        error: 'Storage full — free up space and try again',
      };
    }

    return {
      bookNumber: book.number,
      success: false,
      error: `Download failed: ${message}`,
    };
  }
}

export async function downloadBulk(
  booksToDownload: BookWithDerived[],
  rootHandle: FileSystemDirectoryHandle,
  skipComplete: boolean,
  completedBooks: Set<number>,
  onBookProgress: (progress: DownloadProgress) => void,
  onBulkProgress: (progress: BulkProgress) => void,
  onBookComplete: (result: DownloadResult) => void,
  abortSignal: AbortSignal
): Promise<void> {
  const filtered = skipComplete
    ? booksToDownload.filter((b) => !completedBooks.has(b.number))
    : booksToDownload;

  for (let i = 0; i < filtered.length; i++) {
    if (abortSignal.aborted) break;

    const book = filtered[i];
    onBulkProgress({
      currentIndex: i + 1,
      totalBooks: filtered.length,
      currentBook: book,
    });

    const result = await downloadBook(book, rootHandle, onBookProgress, abortSignal);
    onBookComplete(result);

    if (abortSignal.aborted) break;
  }
}
