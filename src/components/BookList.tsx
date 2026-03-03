import { useState } from 'react';
import type { BookWithDerived } from '../data/books';
import { otBooks, ntBooks } from '../data/books';
import type { AllDownloadState } from '../lib/downloadState';
import { getBookState } from '../lib/downloadState';
import { BookRow } from './BookRow';

interface BookListProps {
  state: AllDownloadState;
  disabled: boolean;
  onDownload: (book: BookWithDerived) => void;
  onCancel: (bookNumber: number) => void;
}

interface SectionProps {
  title: string;
  books: BookWithDerived[];
  state: AllDownloadState;
  disabled: boolean;
  onDownload: (book: BookWithDerived) => void;
  onCancel: (bookNumber: number) => void;
}

function Section({
  title,
  books,
  state,
  disabled,
  onDownload,
  onCancel,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="book-section">
      <button
        className="section-header"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <h2 className="section-title">{title}</h2>
        <span className="section-toggle">{collapsed ? '+' : '\u2212'}</span>
      </button>

      {!collapsed && (
        <div className="section-books">
          {books.map((book) => (
            <BookRow
              key={book.number}
              book={book}
              bookState={getBookState(state, book.number)}
              disabled={disabled}
              onDownload={onDownload}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function BookList({ state, disabled, onDownload, onCancel }: BookListProps) {
  return (
    <div className="book-list">
      <Section
        title="Old Testament"
        books={otBooks}
        state={state}
        disabled={disabled}
        onDownload={onDownload}
        onCancel={onCancel}
      />
      <Section
        title="New Testament"
        books={ntBooks}
        state={state}
        disabled={disabled}
        onDownload={onDownload}
        onCancel={onCancel}
      />
    </div>
  );
}
