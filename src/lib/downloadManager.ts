import type { BookWithDerived } from '../data/books';
import { books } from '../data/books';
import { getBookDirectory, writeFile, invalidateBibleDirCache } from './fileSystem';

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

// Minimum valid MP3 file size (10 KB) — any Bible book audio will be much larger
const MIN_MP3_SIZE = 10 * 1024;

// Number of automatic retries for transient network errors
const MAX_RETRIES = 2;

// Delay between retries in ms (doubles each attempt: 1s, 2s)
const RETRY_BASE_DELAY = 1000;

function isCorsOrNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    // Different browsers use different messages for network/CORS failures
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Validate that data starts with a valid MP3 header.
 * Checks for ID3v2 tag ("ID3") or MPEG audio frame sync (0xFF 0xE0+).
 */
export function isValidMp3(data: Uint8Array): boolean {
  if (data.length < 4) return false;

  // ID3v2 tag: starts with "ID3" (0x49 0x44 0x33)
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    return true;
  }

  // MPEG audio frame sync: 0xFF followed by 0xE0+ (11 sync bits set)
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) {
    return true;
  }

  return false;
}

function isTransientError(err: unknown): boolean {
  if (isCorsOrNetworkError(err)) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnreset')) {
      return true;
    }
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStaleHandleError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    err.message.includes('state cached in an interface object')
  );
}

export async function fetchWithFallback(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  const tried: string[] = [];

  // Attempt 1 — direct fetch (works when CORS headers are present)
  try {
    console.log(`[download] trying direct: ${url}`);
    tried.push(`direct: ${url}`);
    const resp = await fetch(url, { signal });
    if (resp.ok) {
      console.log(`[download] direct OK (${resp.status})`);
      return resp;
    }
    console.warn(`[download] direct failed: ${resp.status} ${resp.statusText}`);
  } catch (err) {
    console.warn(`[download] direct error:`, err);
    // Only fall through to proxies for CORS / network errors
    if (!isCorsOrNetworkError(err)) throw err;
  }

  // Attempt 2+ — try each CORS proxy in order until one succeeds
  let lastResponse: Response | undefined;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxied = CORS_PROXIES[i](url);
    try {
      console.log(`[download] trying proxy ${i + 1}: ${proxied}`);
      tried.push(`proxy${i + 1}: ${proxied}`);
      const resp = await fetch(proxied, { signal });
      if (resp.ok) {
        console.log(`[download] proxy ${i + 1} OK (${resp.status})`);
        return resp;
      }
      console.warn(`[download] proxy ${i + 1} failed: ${resp.status} ${resp.statusText}`);
      lastResponse = resp;
    } catch (err) {
      console.warn(`[download] proxy ${i + 1} error:`, err);
      // On the last proxy, rethrow so the caller sees the error
      if (i === CORS_PROXIES.length - 1) throw err;
      // Otherwise try the next proxy
    }
  }

  console.error(`[download] all attempts failed for: ${url}`);
  console.error(`[download] URLs tried:`, tried);

  // All proxies returned non-ok responses; return the last one so the
  // caller can inspect the status code.
  return lastResponse!;
}

async function downloadBookOnce(
  book: BookWithDerived,
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<DownloadResult> {
  console.log(`[download] starting ${book.name}: ${book.url}`);
  const response = await fetchWithFallback(book.url, abortSignal);

  if (!response.ok) {
    return {
      bookNumber: book.number,
      success: false,
      error: `Server returned ${response.status} ${response.statusText} for ${book.url}`,
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

  // Validate: content-length mismatch means a partial/truncated download
  if (total > 0 && loaded !== total) {
    return {
      bookNumber: book.number,
      success: false,
      error: `Download incomplete: received ${loaded} of ${total} bytes. Try again.`,
    };
  }

  // Validate: file is too small to be a real audio book
  if (data.length < MIN_MP3_SIZE) {
    return {
      bookNumber: book.number,
      success: false,
      error: 'Download failed: file too small — server may have returned an error page. Try again.',
    };
  }

  // Validate: data must start with a valid MP3 header (ID3 tag or sync word)
  if (!isValidMp3(data)) {
    return {
      bookNumber: book.number,
      success: false,
      error: 'Download failed: received invalid data instead of audio. Try again.',
    };
  }

  // Write to file system — retry on stale directory handle errors
  // (common on Android Chrome where cached handles go stale quickly)
  for (let fsAttempt = 0; fsAttempt < 3; fsAttempt++) {
    try {
      const bookDir = await getBookDirectory(rootHandle, book.folderName);
      await writeFile(bookDir, book.fileName, data);
      return { bookNumber: book.number, success: true };
    } catch (fsErr) {
      if (fsAttempt < 2 && isStaleHandleError(fsErr)) {
        invalidateBibleDirCache(rootHandle);
        await delay(500 * (fsAttempt + 1));
        continue;
      }
      return {
        bookNumber: book.number,
        success: false,
        error: fsErr instanceof Error ? fsErr.message : 'File system write failed',
      };
    }
  }

  return { bookNumber: book.number, success: true };
}

export async function downloadBook(
  book: BookWithDerived,
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<DownloadResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await downloadBookOnce(book, rootHandle, onProgress, abortSignal);

      // If the download succeeded or was cancelled, return immediately
      if (result.success || result.error === 'Download cancelled') {
        return result;
      }

      // For non-retryable HTTP errors (4xx), return immediately
      if (result.error?.startsWith('Server returned 4')) {
        return result;
      }

      // For other errors, retry if we have attempts left
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY * Math.pow(2, attempt));
        // Reset progress before retrying
        onProgress({ bookNumber: book.number, loaded: 0, total: 0, percent: 0 });
        continue;
      }

      return result;
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

      // Detect storage full errors — not retryable
      if (message.includes('quota') || message.includes('storage')) {
        return {
          bookNumber: book.number,
          success: false,
          error: 'Storage full — free up space and try again',
        };
      }

      // For transient network errors, retry if we have attempts left
      if (isTransientError(err) && attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY * Math.pow(2, attempt));
        onProgress({ bookNumber: book.number, loaded: 0, total: 0, percent: 0 });
        continue;
      }

      // Provide a clearer message for CORS / network failures
      if (isCorsOrNetworkError(err)) {
        return {
          bookNumber: book.number,
          success: false,
          error: `Download failed: unable to reach the server for ${book.url}. Check your connection and try again.`,
        };
      }

      return {
        bookNumber: book.number,
        success: false,
        error: `Download failed: ${message}`,
      };
    }
  }

  // Should not reach here, but satisfy TypeScript
  return {
    bookNumber: book.number,
    success: false,
    error: 'Download failed after retries',
  };
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

// --- Import-based flow (open in Chrome + import from file system) ---

export function openInBrowser(url: string): void {
  window.open(url, '_blank');
}

export function matchBookFromFilename(filename: string): BookWithDerived | undefined {
  const match = filename.match(/^MSB_(\d{2})_([A-Za-z0-9]+)/i);
  if (!match) return undefined;
  const num = parseInt(match[1], 10);
  return books.find((b) => b.number === num);
}

export async function importBookFromData(
  data: Uint8Array,
  book: BookWithDerived,
  rootHandle: FileSystemDirectoryHandle,
): Promise<DownloadResult> {
  if (data.length < MIN_MP3_SIZE) {
    return {
      bookNumber: book.number,
      success: false,
      error: 'File too small — this may not be a valid audio file.',
    };
  }

  if (!isValidMp3(data)) {
    return {
      bookNumber: book.number,
      success: false,
      error: 'Invalid file — not a valid MP3 audio file.',
    };
  }

  // Write to file system — retry on stale directory handle errors
  // (common on Android Chrome where cached handles go stale quickly)
  for (let fsAttempt = 0; fsAttempt < 3; fsAttempt++) {
    try {
      const bookDir = await getBookDirectory(rootHandle, book.folderName);
      await writeFile(bookDir, book.fileName, data);
      return { bookNumber: book.number, success: true };
    } catch (fsErr) {
      if (fsAttempt < 2 && isStaleHandleError(fsErr)) {
        invalidateBibleDirCache(rootHandle);
        await delay(500 * (fsAttempt + 1));
        continue;
      }
      return {
        bookNumber: book.number,
        success: false,
        error: fsErr instanceof Error ? fsErr.message : 'File system write failed',
      };
    }
  }

  return { bookNumber: book.number, success: true };
}
