import type { BookWithDerived } from '../data/books';
import type { BookDownloadState } from '../lib/downloadState';

interface BookRowProps {
  book: BookWithDerived;
  bookState: BookDownloadState;
  disabled: boolean;
  onDownload: (book: BookWithDerived) => void;
  onCancel: (bookNumber: number) => void;
}

function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

export function BookRow({
  book,
  bookState,
  disabled,
  onDownload,
  onCancel,
}: BookRowProps) {
  const { status, progress, error } = bookState;

  return (
    <div className={`book-row book-row--${status}`}>
      <div className="book-info">
        <span className="book-number">{formatNumber(book.number)}</span>
        <span className="book-name">{book.name}</span>
        <span className={`status-badge status-badge--${status}`}>
          {status === 'not_started' && ''}
          {status === 'downloading' && `${progress}%`}
          {status === 'complete' && 'Done'}
          {status === 'error' && 'Error'}
        </span>
      </div>

      {status === 'downloading' && (
        <div className="progress-bar-container">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {error && <p className="book-error">{error}</p>}

      <div className="book-actions">
        {status === 'downloading' ? (
          <button
            className="btn btn-cancel-small"
            onClick={() => onCancel(book.number)}
          >
            Cancel
          </button>
        ) : status === 'complete' ? (
          <button
            className="btn btn-again"
            disabled={disabled}
            onClick={() => onDownload(book)}
          >
            Download Again
          </button>
        ) : (
          <button
            className="btn btn-download"
            disabled={disabled}
            onClick={() => onDownload(book)}
          >
            {status === 'error' ? 'Retry' : 'Download'}
          </button>
        )}
      </div>
    </div>
  );
}
