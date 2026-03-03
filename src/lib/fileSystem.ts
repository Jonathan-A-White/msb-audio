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

// Cache the *path* from root to the Bible directory (not the handle itself)
// so we only enumerate once but always navigate with fresh handles.
// Stale FileSystemDirectoryHandle objects cause errors on Android Chrome.
const bibleDirPathCache = new WeakMap<FileSystemDirectoryHandle, string[]>();

export function invalidateBibleDirCache(
  rootHandle: FileSystemDirectoryHandle
): void {
  bibleDirPathCache.delete(rootHandle);
}

async function detectBibleDirectoryPath(
  rootHandle: FileSystemDirectoryHandle
): Promise<string[]> {
  // Detect which level of Books/Audio/Bible the user selected.
  // Returns the subdirectory names needed to reach the Bible level.
  try {
    const entries = new Set<string>();
    for await (const entry of rootHandle.values()) {
      entries.add(entry.name);
    }

    // If the directory already has numbered book folders (e.g. "43-John"), we're at Bible level
    const hasBookFolders = [...entries].some((name) => /^\d{2}-/.test(name));
    if (hasBookFolders) return [];

    if (entries.has('Bible')) return ['Bible'];
    if (entries.has('Audio')) return ['Audio', 'Bible'];
    if (entries.has('Books')) return ['Books', 'Audio', 'Bible'];
  } catch {
    // Ignore, proceed with full path creation
  }

  return ['Books', 'Audio', 'Bible'];
}

export async function getBookDirectory(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<FileSystemDirectoryHandle> {
  let path = bibleDirPathCache.get(rootHandle);
  if (!path) {
    path = await detectBibleDirectoryPath(rootHandle);
    bibleDirPathCache.set(rootHandle, path);
  }

  // Always navigate from root to get fresh handles (avoids stale handle errors)
  let current = rootHandle;
  for (const dir of path) {
    current = await current.getDirectoryHandle(dir, { create: true });
  }
  return current.getDirectoryHandle(folderName, { create: true });
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
    await writable.close();
  } catch (err) {
    // Abort discards the temporary write instead of committing empty/corrupt data
    try {
      await writable.abort();
    } catch {
      /* ignore abort errors */
    }
    throw err;
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
