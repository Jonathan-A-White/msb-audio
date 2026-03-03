import { useState, useEffect, useCallback } from 'react';
import {
  isFileSystemAccessSupported,
  pickDirectory,
  getSavedDirectoryHandle,
  clearSavedHandle,
} from '../lib/fileSystem';

interface UseDirectoryHandleReturn {
  handle: FileSystemDirectoryHandle | null;
  directoryName: string | null;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  pick: () => Promise<void>;
  clear: () => Promise<void>;
}

export function useDirectoryHandle(): UseDirectoryHandleReturn {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSupported = isFileSystemAccessSupported();

  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    getSavedDirectoryHandle()
      .then((saved) => {
        if (saved) {
          setHandle(saved);
          setDirectoryName(saved.name);
        }
      })
      .catch(() => {
        // Permission revoked or stale handle
      })
      .finally(() => setIsLoading(false));
  }, [isSupported]);

  const pick = useCallback(async () => {
    setError(null);
    try {
      const h = await pickDirectory();
      setHandle(h);
      setDirectoryName(h.name);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the picker
        return;
      }
      setError('Failed to select directory. Please try again.');
    }
  }, []);

  const clear = useCallback(async () => {
    await clearSavedHandle();
    setHandle(null);
    setDirectoryName(null);
  }, []);

  return { handle, directoryName, isSupported, isLoading, error, pick, clear };
}
