import { useState } from 'react';
import type { BookWithDerived } from '../data/books';
import { otBooks, ntBooks } from '../data/books';
import type { AllDownloadState } from '../lib/downloadState';
import { getBookState } from '../lib/downloadState';
import { BookRow } from './BookRow';

interface BookListProps {
  state: AllDownloadState;
  onOpenInBrowser: (book: BookWithDerived) => void;
}

interface SectionProps {
  title: string;
  books: BookWithDerived[];
  state: AllDownloadState;
  onOpenInBrowser: (book: BookWithDerived) => void;
}

function Section({
  title,
  books,
  state,
  onOpenInBrowser,
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
              onOpenInBrowser={onOpenInBrowser}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function BookList({ state, onOpenInBrowser }: BookListProps) {
  return (
    <div className="book-list">
      <Section
        title="Old Testament"
        books={otBooks}
        state={state}
        onOpenInBrowser={onOpenInBrowser}
      />
      <Section
        title="New Testament"
        books={ntBooks}
        state={state}
        onOpenInBrowser={onOpenInBrowser}
      />
    </div>
  );
}
