import React from 'react';

interface FilePanelTabProps {
  downloadDir: string;
  setDownloadDir: (val: string) => void;
  rightsFormat: string;
  setRightsFormat: (val: string) => void;
}

export const FilePanelTab: React.FC<FilePanelTabProps> = ({
  downloadDir,
  setDownloadDir,
  rightsFormat,
  setRightsFormat,
}) => {
  const handleBrowseDownload = async () => {
    const path = await window.electronAPI.window.openFile();
    if (path) {
      setDownloadDir(path);
    }
  };

  return (
    <div className="flex flex-col gap-4.5">
      <div className="border-b border-[var(--border-color)] pb-1 mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">File Manager Panel Preferences</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 items-center">
        <label className="text-[var(--text-muted)] font-semibold">Default Download Folder:</label>
        <div className="col-span-2 flex gap-1.5 items-center">
          <input 
            type="text" 
            disabled
            value={downloadDir}
            className="flex-1 bg-[var(--bg-panel-header)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none opacity-80"
          />
          <button 
            onClick={handleBrowseDownload}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[3px] px-3.5 py-1 text-xs cursor-pointer select-none transition-all outline-none"
          >
            Browse
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 items-center">
        <label className="text-[var(--text-muted)] font-semibold">Unix Rights Format:</label>
        <select 
          value={rightsFormat}
          onChange={(e) => setRightsFormat(e.target.value)}
          className="col-span-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-[3px] px-2.5 py-1 text-xs outline-none"
        >
          <option value="grouped">Grouped segments (rwx | r-x | r-x)</option>
          <option value="unix">Unix raw format (rwxrwxrwx)</option>
        </select>
      </div>
    </div>
  );
};
