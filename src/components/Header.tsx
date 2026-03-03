interface HeaderProps {
  directoryName: string | null;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  onPickDirectory: () => void;
}

export function Header({
  directoryName,
  isSupported,
  isLoading,
  error,
  onPickDirectory,
}: HeaderProps) {
  return (
    <header className="header">
      <h1 className="header-title">MSB Audio Downloader</h1>

      {!isSupported && (
        <div className="alert alert-error">
          This app requires Chrome on Android. File System Access API is not
          available in your browser.
        </div>
      )}

      {isSupported && (
        <div className="directory-picker">
          <button
            className="btn btn-primary btn-directory"
            onClick={onPickDirectory}
            disabled={isLoading}
          >
            {isLoading
              ? 'Loading...'
              : directoryName
                ? `Folder: ${directoryName}`
                : 'Choose Download Folder'}
          </button>
          {error && <p className="alert alert-error">{error}</p>}
          {!directoryName && !isLoading && (
            <p className="hint">Select a folder to enable downloads</p>
          )}
        </div>
      )}
    </header>
  );
}
