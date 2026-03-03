import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadState,
  saveState,
  getBookState,
  setBookStatus,
  countByStatus,
  type AllDownloadState,
} from '../../src/lib/downloadState';

describe('downloadState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadState', () => {
    it('returns default state when localStorage is empty', () => {
      const state = loadState();
      expect(Object.keys(state)).toHaveLength(66);
      expect(state[1].status).toBe('not_started');
      expect(state[66].status).toBe('not_started');
    });

    it('loads saved state from localStorage', () => {
      const saved: AllDownloadState = { 1: { status: 'complete', progress: 100 } };
      localStorage.setItem('msb-audio-download-state', JSON.stringify(saved));
      const state = loadState();
      expect(state[1].status).toBe('complete');
    });

    it('resets stale downloading states to not_started', () => {
      const saved: AllDownloadState = {
        1: { status: 'downloading', progress: 50 },
        2: { status: 'complete', progress: 100 },
      };
      localStorage.setItem('msb-audio-download-state', JSON.stringify(saved));
      const state = loadState();
      expect(state[1].status).toBe('not_started');
      expect(state[2].status).toBe('complete');
    });

    it('returns default state when localStorage has invalid JSON', () => {
      localStorage.setItem('msb-audio-download-state', 'invalid json');
      const state = loadState();
      expect(Object.keys(state)).toHaveLength(66);
      expect(state[1].status).toBe('not_started');
    });
  });

  describe('saveState', () => {
    it('persists state to localStorage', () => {
      const state: AllDownloadState = { 1: { status: 'complete', progress: 100 } };
      saveState(state);
      const raw = localStorage.getItem('msb-audio-download-state');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toEqual(state);
    });
  });

  describe('getBookState', () => {
    it('returns book state if it exists', () => {
      const state: AllDownloadState = {
        1: { status: 'complete', progress: 100 },
      };
      expect(getBookState(state, 1).status).toBe('complete');
    });

    it('returns default state for unknown book', () => {
      const state: AllDownloadState = {};
      const result = getBookState(state, 99);
      expect(result.status).toBe('not_started');
      expect(result.progress).toBe(0);
    });
  });

  describe('setBookStatus', () => {
    it('updates book status and saves to localStorage', () => {
      const state = loadState();
      const newState = setBookStatus(state, 1, 'downloading', 50);
      expect(newState[1].status).toBe('downloading');
      expect(newState[1].progress).toBe(50);

      const raw = localStorage.getItem('msb-audio-download-state');
      expect(raw).not.toBeNull();
    });

    it('stores error message when setting error status', () => {
      const state = loadState();
      const newState = setBookStatus(state, 1, 'error', 0, 'Network error');
      expect(newState[1].status).toBe('error');
      expect(newState[1].error).toBe('Network error');
    });
  });

  describe('countByStatus', () => {
    it('counts all books by status', () => {
      const state = loadState();
      const counts = countByStatus(state);
      expect(counts.not_started).toBe(66);
      expect(counts.complete).toBe(0);
    });

    it('counts OT books by status', () => {
      const state = loadState();
      const updated = setBookStatus(state, 1, 'complete', 100);
      const counts = countByStatus(updated, 'OT');
      expect(counts.complete).toBe(1);
      expect(counts.not_started).toBe(38);
    });

    it('counts NT books by status', () => {
      const state = loadState();
      const updated = setBookStatus(state, 40, 'complete', 100);
      const counts = countByStatus(updated, 'NT');
      expect(counts.complete).toBe(1);
      expect(counts.not_started).toBe(26);
    });
  });
});
