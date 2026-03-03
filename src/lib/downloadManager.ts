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

// CORS proxies tried in order when the direct fetch fails (e.g. missing
// Access-Control-Allow-Origin header on openbible.com, or proxy returning 403).
export const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

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
    // Only fall through to proxies for CORS / network errors
    if (!isCorsOrNetworkError(err)) throw err;
  }

  // Attempt 2+ — try each CORS proxy in order until one succeeds
  let lastResponse: Response | undefined;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxied = CORS_PROXIES[i](url);
    try {
      const resp = await fetch(proxied, { signal });
      if (resp.ok) return resp;
      lastResponse = resp;
    } catch (err) {
      // On the last proxy, rethrow so the caller sees the error
      if (i === CORS_PROXIES.length - 1) throw err;
      // Otherwise try the next proxy
    }
  }

  // All proxies returned non-ok responses; return the last one so the
  // caller can inspect the status code.
  return lastResponse!;
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
