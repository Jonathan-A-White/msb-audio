import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFileSystemAccessSupported } from '../../src/lib/fileSystem';

describe('fileSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isFileSystemAccessSupported', () => {
    it('returns true when showDirectoryPicker exists on window', () => {
      window.showDirectoryPicker = vi.fn();
      expect(isFileSystemAccessSupported()).toBe(true);
    });

    it('returns false when showDirectoryPicker is not available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).showDirectoryPicker;
      expect(isFileSystemAccessSupported()).toBe(false);
    });
  });
});
