import { books } from '../data/books';

export type DownloadStatus = 'not_started' | 'downloading' | 'complete' | 'error';

export interface BookDownloadState {
  status: DownloadStatus;
  progress: number; // 0-100
  error?: string;
}

export type AllDownloadState = Record<number, BookDownloadState>;

const STORAGE_KEY = 'msb-audio-download-state';

const defaultState: BookDownloadState = {
  status: 'not_started',
  progress: 0,
};

export function loadState(): AllDownloadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initDefaultState();
    const parsed = JSON.parse(raw) as AllDownloadState;
    // Reset any stale 'downloading' states to 'not_started'
    for (const key of Object.keys(parsed)) {
      const num = Number(key);
      if (parsed[num]?.status === 'downloading') {
        parsed[num] = { ...defaultState };
      }
    }
    return parsed;
  } catch {
    return initDefaultState();
  }
}

function initDefaultState(): AllDownloadState {
  const state: AllDownloadState = {};
  for (const book of books) {
    state[book.number] = { ...defaultState };
  }
  return state;
}

export function saveState(state: AllDownloadState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getBookState(state: AllDownloadState, bookNumber: number): BookDownloadState {
  return state[bookNumber] ?? { ...defaultState };
}

export function setBookStatus(
  state: AllDownloadState,
  bookNumber: number,
  status: DownloadStatus,
  progress = 0,
  error?: string
): AllDownloadState {
  const newState = { ...state };
  newState[bookNumber] = { status, progress, error };
  saveState(newState);
  return newState;
}

export function countByStatus(
  state: AllDownloadState,
  testament?: 'OT' | 'NT'
): Record<DownloadStatus, number> {
  const counts: Record<DownloadStatus, number> = {
    not_started: 0,
    downloading: 0,
    complete: 0,
    error: 0,
  };
  const filteredBooks = testament ? books.filter((b) => b.testament === testament) : books;
  for (const book of filteredBooks) {
    const s = getBookState(state, book.number);
    counts[s.status]++;
  }
  return counts;
}
