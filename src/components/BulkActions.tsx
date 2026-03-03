import type { BulkProgress } from '../lib/downloadManager';
import type { AllDownloadState } from '../lib/downloadState';
import { countByStatus } from '../lib/downloadState';

interface BulkActionsProps {
  disabled: boolean;
  isBulkImporting: boolean;
  bulkProgress: BulkProgress | null;
  state: AllDownloadState;
  lastScanCount: number | null;
  onScanAndImport: () => void;
  onImportFiles: () => void;
  onCancelBulk: () => void;
}

export function BulkActions({
  disabled,
  isBulkImporting,
  bulkProgress,
  state,
  lastScanCount,
  onScanAndImport,
  onImportFiles,
  onCancelBulk,
}: BulkActionsProps) {
  const allCounts = countByStatus(state);

  if (isBulkImporting && bulkProgress) {
    return (
      <div className="bulk-actions">
        <div className="bulk-progress">
          <p className="bulk-progress-text">
            Importing {bulkProgress.currentIndex} of{' '}
            {bulkProgress.totalBooks} ({bulkProgress.currentBook.name})
          </p>
          <button className="btn btn-cancel" onClick={onCancelBulk}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bulk-actions">
      <p className="bulk-hint">
        1. Tap Download to get files in Chrome.
        <br />
        2. Use your file manager to move them into this folder.
        <br />
        3. Tap <strong>Scan &amp; Import</strong> to organize them.
      </p>
      <div className="bulk-buttons">
        <button
          className="btn btn-bulk"
          disabled={disabled}
          onClick={onScanAndImport}
        >
          Scan &amp; Import
          <span className="btn-count">{allCounts.complete}/66</span>
        </button>
        <button
          className="btn btn-bulk-secondary"
          disabled={disabled}
          onClick={onImportFiles}
        >
          Pick Files Instead
        </button>
      </div>
      {lastScanCount !== null && lastScanCount === 0 && (
        <p className="bulk-hint scan-result">
          No MSB audio files found in folder. Move your downloaded MP3 files
          into the selected folder first.
        </p>
      )}
    </div>
  );
}
