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

// CORS proxy used as fallback when the direct fetch fails (e.g. missing
// Access-Control-Allow-Origin header on openbible.com).
const CORS_PROXY = 'https://corsproxy.io/?';

function isCorsOrNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return true;
  }
  return false;
}

export async function fetchWithFallback(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  // Attempt 1 — direct fetch (works when CORS headers are present)
  try {
    const resp = await fetch(url, { signal });
    if (resp.ok) return resp;
  } catch (err) {
    // Only fall through to proxy for CORS / network errors
    if (!isCorsOrNetworkError(err)) throw err;
  }

  // Attempt 2 — CORS proxy fallback
  const proxied = `${CORS_PROXY}${encodeURIComponent(url)}`;
  return fetch(proxied, { signal });
}

export async function downloadBook(
  book: BookWithDerived,
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<DownloadResult> {
  try {
    const response = await fetchWithFallback(book.url, abortSignal);

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

    // Provide a clearer message for CORS / network failures
    if (/failed to fetch/i.test(message)) {
      return {
        bookNumber: book.number,
        success: false,
        error: 'Download failed: unable to reach the server. Check your connection and try again.',
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
