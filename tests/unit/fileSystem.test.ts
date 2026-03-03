import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFileSystemAccessSupported, getBookDirectory } from '../../src/lib/fileSystem';

// Helper: create a mock FileSystemDirectoryHandle whose values() yields the
// given child entry names.  getDirectoryHandle creates/returns nested mocks.
function mockDirHandle(
  name: string,
  childNames: string[] = [],
  children: Record<string, FileSystemDirectoryHandle> = {},
): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    values: vi.fn().mockImplementation(async function* () {
      for (const n of childNames) {
        yield { kind: 'directory', name: n };
      }
    }),
    getDirectoryHandle: vi.fn().mockImplementation(async (childName: string) => {
      if (children[childName]) return children[childName];
      // Auto-create a new empty mock when { create: true }
      const child = mockDirHandle(childName);
      children[childName] = child;
      return child;
    }),
  } as unknown as FileSystemDirectoryHandle;
  return handle;
}

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

  describe('getBookDirectory', () => {
    it('creates full Books/Audio/Bible/<folder> path from an empty root', async () => {
      const root = mockDirHandle('Internal storage');
      await getBookDirectory(root, '43-John');

      expect(root.getDirectoryHandle).toHaveBeenCalledWith('Books', { create: true });
    });

    it('skips to Audio/Bible/<folder> when root already has an Audio subdir', async () => {
      const root = mockDirHandle('Books', ['Audio']);
      await getBookDirectory(root, '43-John');

      // Should NOT create a nested Books
      const calls = (root.getDirectoryHandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe('Audio');
    });

    it('skips to Bible/<folder> when root already has a Bible subdir', async () => {
      const root = mockDirHandle('Audio', ['Bible']);
      await getBookDirectory(root, '43-John');

      const calls = (root.getDirectoryHandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe('Bible');
    });

    it('creates <folder> directly when root has numbered book folders', async () => {
      const root = mockDirHandle('Bible', ['43-John', '49-Ephesians']);
      await getBookDirectory(root, '01-Genesis');

      const calls = (root.getDirectoryHandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('01-Genesis');
    });

    it('navigates into existing Books when root has a Books subdir', async () => {
      const root = mockDirHandle('Internal storage', ['Books', 'DCIM', 'Music']);
      await getBookDirectory(root, '43-John');

      const calls = (root.getDirectoryHandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe('Books');
    });
  });
});
