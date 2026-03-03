import { Header } from './components/Header';
import { BulkActions } from './components/BulkActions';
import { BookList } from './components/BookList';
import { useDirectoryHandle } from './hooks/useDirectoryHandle';
import { useDownload } from './hooks/useDownload';
import './App.css';

export function App() {
  const {
    handle,
    directoryName,
    isSupported,
    isLoading,
    error,
    pick,
  } = useDirectoryHandle();

  const {
    state,
    bulkProgress,
    isBulkImporting,
    lastScanCount,
    openBookInBrowser,
    importFiles,
    scanAndImport,
    cancelBulk,
  } = useDownload(handle);

  return (
    <div className="app">
      <Header
        directoryName={directoryName}
        isSupported={isSupported}
        isLoading={isLoading}
        error={error}
        onPickDirectory={pick}
      />

      <BulkActions
        disabled={!handle || !isSupported}
        isBulkImporting={isBulkImporting}
        bulkProgress={bulkProgress}
        state={state}
        lastScanCount={lastScanCount}
        onScanAndImport={scanAndImport}
        onImportFiles={importFiles}
        onCancelBulk={cancelBulk}
      />

      <BookList
        state={state}
        onOpenInBrowser={openBookInBrowser}
      />
    </div>
  );
}
