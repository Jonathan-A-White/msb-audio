import type { BulkProgress } from '../lib/downloadManager';
import type { AllDownloadState } from '../lib/downloadState';
import { countByStatus } from '../lib/downloadState';

interface BulkActionsProps {
  disabled: boolean;
  isBulkImporting: boolean;
  bulkProgress: BulkProgress | null;
  state: AllDownloadState;
  onImportFiles: () => void;
}

export function BulkActions({
  disabled,
  isBulkImporting,
  bulkProgress,
  state,
  onImportFiles,
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
        </div>
      </div>
    );
  }

  return (
    <div className="bulk-actions">
      <p className="bulk-hint">
        Tap Download to get files in Chrome, then Import to add them to your audio player.
      </p>
      <div className="bulk-buttons">
        <button
          className="btn btn-bulk"
          disabled={disabled}
          onClick={onImportFiles}
        >
          Import Files
          <span className="btn-count">{allCounts.complete}/66</span>
        </button>
      </div>
    </div>
  );
}
