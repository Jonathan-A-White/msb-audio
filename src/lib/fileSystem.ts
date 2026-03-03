import { get, set, del } from 'idb-keyval';

const DIR_HANDLE_KEY = 'msb-audio-dir-handle';

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await set(DIR_HANDLE_KEY, handle);
  return handle;
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
    if (!handle) return null;

    // Verify we still have permission
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') return handle;

    // Try to request permission
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    if (requested === 'granted') return handle;

    return null;
  } catch {
    return null;
  }
}

export async function clearSavedHandle(): Promise<void> {
  await del(DIR_HANDLE_KEY);
}

async function getOrCreateSubDir(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

export async function getBookDirectory(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> {
  // Check if root already contains Books/Audio/Bible path
  // Create: <root>/Books/Audio/Bible/<folderName>/
  let current = rootHandle;

  // Check if root is already the Bible directory by looking for expected structure
  try {
    // Try to detect if we're already inside Books/Audio/Bible
    const entries: string[] = [];
    for await (const entry of current.values()) {
      entries.push(entry.name);
    }

    // If the directory already has numbered book folders, assume we're at the Bible level
    const hasBookFolders = entries.some((name) => /^\d{2}-/.test(name));
    if (hasBookFolders) {
      return getOrCreateSubDir(current, folderName);
    }
  } catch {
    // Ignore, proceed with full path creation
  }

  current = await getOrCreateSubDir(current, 'Books');
  current = await getOrCreateSubDir(current, 'Audio');
  current = await getOrCreateSubDir(current, 'Bible');
  return getOrCreateSubDir(current, folderName);
}

export async function writeFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  data: Uint8Array
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(data as unknown as BufferSource);
  } finally {
    await writable.close();
  }
}
