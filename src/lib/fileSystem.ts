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
  // Detect which level of Books/Audio/Bible the user selected and navigate accordingly.
  // Supported scenarios:
  //   - User picks root (e.g. Internal storage) → create Books/Audio/Bible/<folderName>
  //   - User picks "Books"                      → create Audio/Bible/<folderName>
  //   - User picks "Audio"                      → create Bible/<folderName>
  //   - User picks "Bible"                      → create <folderName>
  let current = rootHandle;

  try {
    const entries = new Set<string>();
    for await (const entry of current.values()) {
      entries.add(entry.name);
    }

    // If the directory already has numbered book folders (e.g. "43-John"), we're at Bible level
    const hasBookFolders = [...entries].some((name) => /^\d{2}-/.test(name));
    if (hasBookFolders) {
      return getOrCreateSubDir(current, folderName);
    }

    // Detect intermediate levels by checking for known subdirectory names
    if (entries.has('Bible')) {
      // We're at the Audio level
      current = await getOrCreateSubDir(current, 'Bible');
      return getOrCreateSubDir(current, folderName);
    }

    if (entries.has('Audio')) {
      // We're at the Books level
      current = await getOrCreateSubDir(current, 'Audio');
      current = await getOrCreateSubDir(current, 'Bible');
      return getOrCreateSubDir(current, folderName);
    }

    if (entries.has('Books')) {
      // We're at the root level and Books already exists
      current = await getOrCreateSubDir(current, 'Books');
      current = await getOrCreateSubDir(current, 'Audio');
      current = await getOrCreateSubDir(current, 'Bible');
      return getOrCreateSubDir(current, folderName);
    }
  } catch {
    // Ignore, proceed with full path creation
  }

  // No existing structure detected — create the full path
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

export async function pickMp3File(): Promise<File> {
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'MP3 audio files', accept: { 'audio/mpeg': ['.mp3'] } }],
  });
  return handle.getFile();
}

export async function pickSourceDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: 'read' });
}

export async function scanForMsbFiles(
  dirHandle: FileSystemDirectoryHandle
): Promise<Map<string, File>> {
  const results = new Map<string, File>();
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && /^MSB_\d{2}_[A-Za-z0-9]+/i.test(entry.name) && entry.name.toLowerCase().endsWith('.mp3')) {
      const fileHandle = await dirHandle.getFileHandle(entry.name);
      results.set(entry.name, await fileHandle.getFile());
    }
  }
  return results;
}
