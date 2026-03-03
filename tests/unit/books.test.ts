import { describe, it, expect } from 'vitest';
import { books, otBooks, ntBooks, getBook } from '../../src/data/books';

describe('books data', () => {
  it('has exactly 66 books', () => {
    expect(books).toHaveLength(66);
  });

  it('has 39 OT books and 27 NT books', () => {
    expect(otBooks).toHaveLength(39);
    expect(ntBooks).toHaveLength(27);
  });

  it('books are in canonical order (1-66)', () => {
    books.forEach((book, index) => {
      expect(book.number).toBe(index + 1);
    });
  });

  it('OT books are numbered 1-39', () => {
    otBooks.forEach((book, index) => {
      expect(book.number).toBe(index + 1);
      expect(book.testament).toBe('OT');
    });
  });

  it('NT books are numbered 40-66', () => {
    ntBooks.forEach((book, index) => {
      expect(book.number).toBe(index + 40);
      expect(book.testament).toBe('NT');
    });
  });

  it('derives correct URL for each book', () => {
    const gen = books[0];
    expect(gen.url).toBe('https://openbible.com/audio/msb_books/MSB_01_Gen.mp3');

    const eph = getBook(49)!;
    expect(eph.url).toBe('https://openbible.com/audio/msb_books/MSB_49_Eph.mp3');

    const rev = books[65];
    expect(rev.url).toBe('https://openbible.com/audio/msb_books/MSB_66_Rev.mp3');
  });

  it('derives correct folder names with zero-padded numbers', () => {
    expect(books[0].folderName).toBe('01-Genesis');
    expect(books[8].folderName).toBe('09-1 Samuel');
    expect(books[48].folderName).toBe('49-Ephesians');
    expect(books[65].folderName).toBe('66-Revelation');
  });

  it('derives correct file names', () => {
    expect(books[0].fileName).toBe('MSB_01_Gen.mp3');
    expect(books[8].fileName).toBe('MSB_09_1Sa.mp3');
    expect(books[48].fileName).toBe('MSB_49_Eph.mp3');
  });

  it('getBook returns correct book by number', () => {
    const book = getBook(1);
    expect(book).toBeDefined();
    expect(book!.name).toBe('Genesis');
    expect(book!.abbr).toBe('Gen');
  });

  it('getBook returns undefined for invalid number', () => {
    expect(getBook(0)).toBeUndefined();
    expect(getBook(67)).toBeUndefined();
  });

  it('all books have non-empty name and abbreviation', () => {
    for (const book of books) {
      expect(book.name.length).toBeGreaterThan(0);
      expect(book.abbr.length).toBeGreaterThan(0);
    }
  });

  it('all abbreviations are unique', () => {
    const abbrs = books.map((b) => b.abbr);
    expect(new Set(abbrs).size).toBe(66);
  });
});
