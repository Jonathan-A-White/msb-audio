import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBook } from '../../src/lib/downloadManager';
import { books } from '../../src/data/books';

// Mock the fileSystem module
vi.mock('../../src/lib/fileSystem', () => ({
  getBookDirectory: vi.fn().mockResolvedValue({}),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('downloadManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
  });
});
