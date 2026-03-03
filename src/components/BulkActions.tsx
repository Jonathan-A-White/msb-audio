import type { BulkProgress } from '../lib/downloadManager';
import type { AllDownloadState } from '../lib/downloadState';
import { countByStatus } from '../lib/downloadState';

interface BulkActionsProps {
  disabled: boolean;
  isBulkDownloading: boolean;
  bulkProgress: BulkProgress | null;
  state: AllDownloadState;
  onDownloadAll: (redownload: boolean) => void;
  onDownloadOT: (redownload: boolean) => void;
  onDownloadNT: (redownload: boolean) => void;
  onCancel: () => void;
}

export function BulkActions({
  disabled,
  isBulkDownloading,
  bulkProgress,
  state,
  onDownloadAll,
  onDownloadOT,
  onDownloadNT,
  onCancel,
}: BulkActionsProps) {
  const allCounts = countByStatus(state);
  const otCounts = countByStatus(state, 'OT');
  const ntCounts = countByStatus(state, 'NT');

  const hasAllComplete = allCounts.complete === 66;
  const hasOTComplete = otCounts.complete === 39;
  const hasNTComplete = ntCounts.complete === 27;

  if (isBulkDownloading && bulkProgress) {
    return (
      <div className="bulk-actions">
        <div className="bulk-progress">
          <p className="bulk-progress-text">
            Downloading {bulkProgress.currentIndex} of{' '}
            {bulkProgress.totalBooks} ({bulkProgress.currentBook.name})
          </p>
          <button className="btn btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bulk-actions">
      <div className="bulk-buttons">
        <button
          className="btn btn-bulk"
          disabled={disabled}
          onClick={() => onDownloadAll(false)}
        >
          Download All
          <span className="btn-count">{allCounts.complete}/66</span>
        </button>
        <button
          className="btn btn-bulk"
          disabled={disabled}
          onClick={() => onDownloadOT(false)}
        >
          Download OT
          <span className="btn-count">{otCounts.complete}/39</span>
        </button>
        <button
          className="btn btn-bulk"
          disabled={disabled}
          onClick={() => onDownloadNT(false)}
        >
          Download NT
          <span className="btn-count">{ntCounts.complete}/27</span>
        </button>
      </div>

      {(hasAllComplete || hasOTComplete || hasNTComplete) && (
        <div className="bulk-buttons bulk-again">
          {hasAllComplete && (
            <button
              className="btn btn-bulk-again"
              disabled={disabled}
              onClick={() => onDownloadAll(true)}
            >
              Download All Again
            </button>
          )}
          {hasOTComplete && (
            <button
              className="btn btn-bulk-again"
              disabled={disabled}
              onClick={() => onDownloadOT(true)}
            >
              Download OT Again
            </button>
          )}
          {hasNTComplete && (
            <button
              className="btn btn-bulk-again"
              disabled={disabled}
              onClick={() => onDownloadNT(true)}
            >
              Download NT Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
