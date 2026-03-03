export interface Book {
  number: number;
  abbr: string;
  name: string;
  testament: 'OT' | 'NT';
}

export interface BookWithDerived extends Book {
  url: string;
  folderName: string;
  fileName: string;
}

const BASE_URL = 'https://openbible.com/audio/msb_books';

const booksRaw: Book[] = [
  { number: 1, abbr: 'Gen', name: 'Genesis', testament: 'OT' },
  { number: 2, abbr: 'Exo', name: 'Exodus', testament: 'OT' },
  { number: 3, abbr: 'Lev', name: 'Leviticus', testament: 'OT' },
  { number: 4, abbr: 'Num', name: 'Numbers', testament: 'OT' },
  { number: 5, abbr: 'Deu', name: 'Deuteronomy', testament: 'OT' },
  { number: 6, abbr: 'Jos', name: 'Joshua', testament: 'OT' },
  { number: 7, abbr: 'Jdg', name: 'Judges', testament: 'OT' },
  { number: 8, abbr: 'Rut', name: 'Ruth', testament: 'OT' },
  { number: 9, abbr: '1Sa', name: '1 Samuel', testament: 'OT' },
  { number: 10, abbr: '2Sa', name: '2 Samuel', testament: 'OT' },
  { number: 11, abbr: '1Ki', name: '1 Kings', testament: 'OT' },
  { number: 12, abbr: '2Ki', name: '2 Kings', testament: 'OT' },
  { number: 13, abbr: '1Ch', name: '1 Chronicles', testament: 'OT' },
  { number: 14, abbr: '2Ch', name: '2 Chronicles', testament: 'OT' },
  { number: 15, abbr: 'Ezr', name: 'Ezra', testament: 'OT' },
  { number: 16, abbr: 'Neh', name: 'Nehemiah', testament: 'OT' },
  { number: 17, abbr: 'Est', name: 'Esther', testament: 'OT' },
  { number: 18, abbr: 'Job', name: 'Job', testament: 'OT' },
  { number: 19, abbr: 'Psa', name: 'Psalms', testament: 'OT' },
  { number: 20, abbr: 'Pro', name: 'Proverbs', testament: 'OT' },
  { number: 21, abbr: 'Ecc', name: 'Ecclesiastes', testament: 'OT' },
  { number: 22, abbr: 'Sng', name: 'Song of Solomon', testament: 'OT' },
  { number: 23, abbr: 'Isa', name: 'Isaiah', testament: 'OT' },
  { number: 24, abbr: 'Jer', name: 'Jeremiah', testament: 'OT' },
  { number: 25, abbr: 'Lam', name: 'Lamentations', testament: 'OT' },
  { number: 26, abbr: 'Ezk', name: 'Ezekiel', testament: 'OT' },
  { number: 27, abbr: 'Dan', name: 'Daniel', testament: 'OT' },
  { number: 28, abbr: 'Hos', name: 'Hosea', testament: 'OT' },
  { number: 29, abbr: 'Jol', name: 'Joel', testament: 'OT' },
  { number: 30, abbr: 'Amo', name: 'Amos', testament: 'OT' },
  { number: 31, abbr: 'Oba', name: 'Obadiah', testament: 'OT' },
  { number: 32, abbr: 'Jon', name: 'Jonah', testament: 'OT' },
  { number: 33, abbr: 'Mic', name: 'Micah', testament: 'OT' },
  { number: 34, abbr: 'Nam', name: 'Nahum', testament: 'OT' },
  { number: 35, abbr: 'Hab', name: 'Habakkuk', testament: 'OT' },
  { number: 36, abbr: 'Zep', name: 'Zephaniah', testament: 'OT' },
  { number: 37, abbr: 'Hag', name: 'Haggai', testament: 'OT' },
  { number: 38, abbr: 'Zec', name: 'Zechariah', testament: 'OT' },
  { number: 39, abbr: 'Mal', name: 'Malachi', testament: 'OT' },
  { number: 40, abbr: 'Mat', name: 'Matthew', testament: 'NT' },
  { number: 41, abbr: 'Mrk', name: 'Mark', testament: 'NT' },
  { number: 42, abbr: 'Luk', name: 'Luke', testament: 'NT' },
  { number: 43, abbr: 'Jhn', name: 'John', testament: 'NT' },
  { number: 44, abbr: 'Act', name: 'Acts', testament: 'NT' },
  { number: 45, abbr: 'Rom', name: 'Romans', testament: 'NT' },
  { number: 46, abbr: '1Co', name: '1 Corinthians', testament: 'NT' },
  { number: 47, abbr: '2Co', name: '2 Corinthians', testament: 'NT' },
  { number: 48, abbr: 'Gal', name: 'Galatians', testament: 'NT' },
  { number: 49, abbr: 'Eph', name: 'Ephesians', testament: 'NT' },
  { number: 50, abbr: 'Php', name: 'Philippians', testament: 'NT' },
  { number: 51, abbr: 'Col', name: 'Colossians', testament: 'NT' },
  { number: 52, abbr: '1Th', name: '1 Thessalonians', testament: 'NT' },
  { number: 53, abbr: '2Th', name: '2 Thessalonians', testament: 'NT' },
  { number: 54, abbr: '1Ti', name: '1 Timothy', testament: 'NT' },
  { number: 55, abbr: '2Ti', name: '2 Timothy', testament: 'NT' },
  { number: 56, abbr: 'Tts', name: 'Titus', testament: 'NT' },
  { number: 57, abbr: 'Phm', name: 'Philemon', testament: 'NT' },
  { number: 58, abbr: 'Heb', name: 'Hebrews', testament: 'NT' },
  { number: 59, abbr: 'Jas', name: 'James', testament: 'NT' },
  { number: 60, abbr: '1Pe', name: '1 Peter', testament: 'NT' },
  { number: 61, abbr: '2Pe', name: '2 Peter', testament: 'NT' },
  { number: 62, abbr: '1Jn', name: '1 John', testament: 'NT' },
  { number: 63, abbr: '2Jn', name: '2 John', testament: 'NT' },
  { number: 64, abbr: '3Jn', name: '3 John', testament: 'NT' },
  { number: 65, abbr: 'Jud', name: 'Jude', testament: 'NT' },
  { number: 66, abbr: 'Rev', name: 'Revelation', testament: 'NT' },
];

function padNumber(n: number): string {
  return n.toString().padStart(2, '0');
}

function deriveBook(book: Book): BookWithDerived {
  const nn = padNumber(book.number);
  const fileName = `MSB_${nn}_${book.abbr}.mp3`;
  return {
    ...book,
    url: `${BASE_URL}/${fileName}`,
    folderName: `${nn}-${book.name}`,
    fileName,
  };
}

export const books: BookWithDerived[] = booksRaw.map(deriveBook);

export const otBooks = books.filter((b) => b.testament === 'OT');
export const ntBooks = books.filter((b) => b.testament === 'NT');

export function getBook(number: number): BookWithDerived | undefined {
  return books.find((b) => b.number === number);
}
