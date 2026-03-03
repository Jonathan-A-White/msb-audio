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
    isBulkDownloading,
    downloadSingle,
    downloadAll,
    downloadOT,
    downloadNT,
    cancelBulk,
    cancelSingle,
  } = useDownload(handle);

  const downloadsDisabled = !handle || !isSupported || isBulkDownloading;

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
        isBulkDownloading={isBulkDownloading}
        bulkProgress={bulkProgress}
        state={state}
        onDownloadAll={downloadAll}
        onDownloadOT={downloadOT}
        onDownloadNT={downloadNT}
        onCancel={cancelBulk}
      />

      <BookList
        state={state}
        disabled={downloadsDisabled}
        onDownload={downloadSingle}
        onCancel={cancelSingle}
      />
    </div>
  );
}
