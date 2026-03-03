import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBook, fetchWithFallback, isValidMp3, CORS_PROXIES } from '../../src/lib/downloadManager';
import { books } from '../../src/data/books';

// Mock the fileSystem module
vi.mock('../../src/lib/fileSystem', () => ({
  getBookDirectory: vi.fn().mockResolvedValue({}),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Build a fake MP3 payload: starts with ID3 header and is > 10 KB
function fakeMp3(size = 20_000): Uint8Array {
  const data = new Uint8Array(size);
  // ID3v2 header
  data[0] = 0x49; // 'I'
  data[1] = 0x44; // 'D'
  data[2] = 0x33; // '3'
  return data;
}

function okResponse(data: Uint8Array = fakeMp3()) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-length': String(data.length) }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }),
  };
}

describe('downloadManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isValidMp3', () => {
    it('accepts data starting with ID3v2 tag', () => {
      const data = new Uint8Array([0x49, 0x44, 0x33, 0x04]);
      expect(isValidMp3(data)).toBe(true);
    });

    it('accepts data starting with MPEG sync word', () => {
      const data = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
      expect(isValidMp3(data)).toBe(true);
    });

    it('rejects data that is too short', () => {
      expect(isValidMp3(new Uint8Array([0x49, 0x44]))).toBe(false);
    });

    it('rejects HTML content', () => {
      // "<htm" in ASCII
      const data = new Uint8Array([0x3c, 0x68, 0x74, 0x6d]);
      expect(isValidMp3(data)).toBe(false);
    });

    it('rejects JSON content', () => {
      // '{"er' in ASCII
      const data = new Uint8Array([0x7b, 0x22, 0x65, 0x72]);
      expect(isValidMp3(data)).toBe(false);
    });
  });

  describe('fetchWithFallback', () => {
    it('returns direct response when fetch succeeds', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to CORS proxy when direct fetch throws TypeError', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: true });

      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      // Second call should use first proxy URL
      const secondCallUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(secondCallUrl).toContain('corsproxy.io');
    });

    it('falls back on Safari-style "Load failed" TypeError', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Load failed'))
        .mockResolvedValueOnce({ ok: true });

      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('tries next proxy when first proxy returns non-ok', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // direct
        .mockResolvedValueOnce({ ok: false, status: 403 })        // first proxy
        .mockResolvedValueOnce({ ok: true });                     // second proxy

      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1 + CORS_PROXIES.length);
      // Third call should use allorigins proxy
      const thirdCallUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2][0];
      expect(thirdCallUrl).toContain('allorigins');
    });

    it('tries next proxy when first proxy throws', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // direct
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // first proxy
        .mockResolvedValueOnce({ ok: true });                     // second proxy

      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('returns last non-ok response when all proxies fail with HTTP errors', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))  // direct
        .mockResolvedValueOnce({ ok: false, status: 403 })        // first proxy
        .mockResolvedValueOnce({ ok: false, status: 502 });       // second proxy

      const resp = await fetchWithFallback('https://example.com/file.mp3');
      expect(resp.ok).toBe(false);
      expect(resp.status).toBe(502);
    });

    it('re-throws non-CORS errors without trying proxy', async () => {
      const err = new DOMException('Aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(err);

      await expect(fetchWithFallback('https://example.com/file.mp3')).rejects.toThrow();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadBook', () => {
    const genesis = books[0];
    const mockRootHandle = {} as FileSystemDirectoryHandle;
    const onProgress = vi.fn();

    it('returns success when fetch and write succeed with valid MP3', async () => {
      const mp3Data = fakeMp3();
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse(mp3Data));

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      // Flush any pending timers (retry delays)
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.bookNumber).toBe(1);
    });

    it('returns error when server returns non-200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('returns error when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('returns error when aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const abortError = new DOMException('Aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await downloadBook(
        genesis,
        mockRootHandle,
        onProgress,
        controller.signal
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('reports progress during download', async () => {
      const mp3Data = fakeMp3(20_000);
      globalThis.fetch = vi.fn().mockResolvedValue(okResponse(mp3Data));

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      await resultPromise;
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          bookNumber: 1,
          loaded: 20_000,
          total: 20_000,
          percent: 100,
        })
      );
    });

    it('handles missing content-length header', async () => {
      const mp3Data = fakeMp3();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(mp3Data);
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: mockStream,
      });

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
      // Progress should report 0 percent when content-length unknown
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ percent: 0 })
      );
    });

    it('succeeds via CORS proxy when direct fetch fails', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(okResponse());

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it('succeeds via second proxy when direct and first proxy fail', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden' })
        .mockResolvedValueOnce(okResponse());

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
    });

    it('shows friendly message when direct and all proxy fetches fail', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('unable to reach the server');
    });

    it('rejects files that are too small (likely error pages)', async () => {
      // 100 bytes with valid MP3 header but way too small
      const tinyData = fakeMp3(100);
      // Must return fresh response on each retry attempt
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(okResponse(tinyData))
      );

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('file too small');
    });

    it('rejects non-MP3 data (e.g. HTML error page from proxy)', async () => {
      // Simulate an HTML error page returned by a CORS proxy
      const htmlData = new Uint8Array(20_000);
      const html = '<html><body>Error</body></html>';
      for (let i = 0; i < html.length; i++) {
        htmlData[i] = html.charCodeAt(i);
      }
      // Must return fresh response on each retry attempt
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(okResponse(htmlData))
      );

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid data');
    });

    it('detects partial downloads via content-length mismatch', async () => {
      // Server says 50000 bytes but we only receive 10240
      const partialData = fakeMp3(10_240);
      // Must return fresh response/stream on each retry attempt
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '50000' }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(partialData));
              controller.close();
            },
          }),
        })
      );

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('incomplete');
    });

    it('retries on transient network errors and eventually succeeds', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        // First attempt: all proxies fail → downloadBookOnce throws
        // Retry 1: succeeds on direct fetch
        .mockImplementation(() => Promise.resolve(okResponse()));

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(true);
      // fetch was called 3 times for first attempt (direct + 2 proxies), then once more for retry
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });

    it('does not retry 4xx client errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const resultPromise = downloadBook(genesis, mockRootHandle, onProgress);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.success).toBe(false);
      // fetchWithFallback tries direct + 2 proxies (3 calls), but no retry loop
      expect(globalThis.fetch).toHaveBeenCalledTimes(1 + CORS_PROXIES.length);
    });
  });
});
