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
    openBookInBrowser,
    importSingle,
    importFromFolder,
  } = useDownload(handle);

  const importDisabled = !handle || !isSupported || isBulkImporting;

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
        onImportFromFolder={importFromFolder}
      />

      <BookList
        state={state}
        importDisabled={importDisabled}
        onOpenInBrowser={openBookInBrowser}
        onImport={importSingle}
      />
    </div>
  );
}
