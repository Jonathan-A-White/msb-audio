import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBook, fetchWithFallback } from '../../src/lib/downloadManager';
import { books } from '../../src/data/books';

// Mock the fileSystem module
vi.mock('../../src/lib/fileSystem', () => ({
  getBookDirectory: vi.fn().mockResolvedValue({}),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function okResponse(data: Uint8Array = new Uint8Array([1, 2, 3])) {
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
      // Second call should use proxy URL
      const secondCallUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(secondCallUrl).toContain('corsproxy.io');
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

    it('returns success when fetch and write succeed', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '3' }),
        body: mockStream,
      });

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
      expect(result.success).toBe(true);
      expect(result.bookNumber).toBe(1);
    });

    it('returns error when server returns non-200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('returns error when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
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
      const chunk = new Uint8Array(100);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        body: mockStream,
      });

      await downloadBook(genesis, mockRootHandle, onProgress);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          bookNumber: 1,
          loaded: 100,
          total: 100,
          percent: 100,
        })
      );
    });

    it('handles missing content-length header', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: mockStream,
      });

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
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

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
      expect(result.success).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('shows friendly message when both direct and proxy fetch fail', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await downloadBook(genesis, mockRootHandle, onProgress);
      expect(result.success).toBe(false);
      expect(result.error).toContain('unable to reach the server');
    });
  });
});
