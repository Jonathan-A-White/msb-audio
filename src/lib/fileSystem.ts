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

// Cache the Bible-level directory handle per root handle to avoid repeated
// directory enumeration, which triggers stale-cache errors on mobile Chrome
// when directory contents change between bulk-import iterations.
const bibleDirCache = new WeakMap<FileSystemDirectoryHandle, FileSystemDirectoryHandle>();

export function invalidateBibleDirCache(
  rootHandle: FileSystemDirectoryHandle
): void {
  bibleDirCache.delete(rootHandle);
}

async function detectBibleDirectory(
  rootHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  // Detect which level of Books/Audio/Bible the user selected and navigate accordingly.
  // Supported scenarios:
  //   - User picks root (e.g. Internal storage) → create Books/Audio/Bible
  //   - User picks "Books"                      → create Audio/Bible
  //   - User picks "Audio"                      → create Bible
  //   - User picks "Bible"                      → already at Bible level
  let current = rootHandle;

  try {
    const entries = new Set<string>();
    for await (const entry of current.values()) {
      entries.add(entry.name);
    }

    // If the directory already has numbered book folders (e.g. "43-John"), we're at Bible level
    const hasBookFolders = [...entries].some((name) => /^\d{2}-/.test(name));
    if (hasBookFolders) {
      return current;
    }

    // Detect intermediate levels by checking for known subdirectory names
    if (entries.has('Bible')) {
      return getOrCreateSubDir(current, 'Bible');
    }

    if (entries.has('Audio')) {
      current = await getOrCreateSubDir(current, 'Audio');
      return getOrCreateSubDir(current, 'Bible');
    }

    if (entries.has('Books')) {
      current = await getOrCreateSubDir(current, 'Books');
      current = await getOrCreateSubDir(current, 'Audio');
      return getOrCreateSubDir(current, 'Bible');
    }
  } catch {
    // Ignore, proceed with full path creation
  }

  // No existing structure detected — create the full path
  current = await getOrCreateSubDir(current, 'Books');
  current = await getOrCreateSubDir(current, 'Audio');
  return getOrCreateSubDir(current, 'Bible');
}

export async function getBookDirectory(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> {
  let bibleDir = bibleDirCache.get(rootHandle);
  if (!bibleDir) {
    bibleDir = await detectBibleDirectory(rootHandle);
    bibleDirCache.set(rootHandle, bibleDir);
  }
  return getOrCreateSubDir(bibleDir, folderName);
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

export async function pickMp3File(): Promise<File> {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'MP3 audio files', accept: { 'audio/mpeg': ['.mp3'] } }],
  });
  return handle.getFile();
}

export async function pickMp3Files(): Promise<File[]> {
  const handles = await window.showOpenFilePicker({
    multiple: true,
    types: [{ description: 'MP3 audio files', accept: { 'audio/mpeg': ['.mp3'] } }],
  });
  const files: File[] = [];
  for (const handle of handles) {
    files.push(await handle.getFile());
  }
  return files;
}
