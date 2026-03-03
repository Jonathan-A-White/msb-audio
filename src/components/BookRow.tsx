import type { BookWithDerived } from '../data/books';
import type { BookDownloadState } from '../lib/downloadState';

interface BookRowProps {
  book: BookWithDerived;
  bookState: BookDownloadState;
  onOpenInBrowser: (book: BookWithDerived) => void;
}

function formatNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

export function BookRow({
  book,
  bookState,
  onOpenInBrowser,
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
          <span className="importing-label">Importing...</span>
        ) : (
          <button
            className="btn btn-download-link"
            onClick={() => onOpenInBrowser(book)}
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}
