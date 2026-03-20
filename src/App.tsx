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
    isSyncing,
    lastScanCount,
    openBookInBrowser,
    importFiles,
    scanAndImport,
    syncWithFileSystem,
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
        isSyncing={isSyncing}
        bulkProgress={bulkProgress}
        state={state}
        lastScanCount={lastScanCount}
        onScanAndImport={scanAndImport}
        onImportFiles={importFiles}
        onSync={syncWithFileSystem}
        onCancelBulk={cancelBulk}
      />

      <BookList
        state={state}
        onOpenInBrowser={openBookInBrowser}
      />
    </div>
  );
}
