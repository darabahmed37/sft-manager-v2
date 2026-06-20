import React, { useState } from 'react';

interface MaintenanceTabProps {
  setLoadingGlobal: (val: boolean) => void;
}

export const MaintenanceTab: React.FC<MaintenanceTabProps> = ({ setLoadingGlobal }) => {
  const [statusMsg, setStatusMsg] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-[var(--border-color)] pb-1 mb-1">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">System Diagnostics & Reset</h3>
      </div>

      {statusMsg && (
        <div className="p-2.5 bg-[var(--glow-color)]/20 border border-[var(--color-primary)]/30 rounded-[3px] text-xs text-[var(--text-main)] mb-1 leading-relaxed">
          {statusMsg}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
          <div>
            <span className="font-semibold text-[var(--text-main)] block">Explore Temporary Directory</span>
            <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Open application downloads cache path</span>
          </div>
          <button 
            onClick={async () => {
              await window.electronAPI.settings.openTemp();
              setStatusMsg('Successfully opened temp folder in system file manager.');
            }}
            className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
          >
            Open Cache
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
          <div>
            <span className="font-semibold text-[var(--text-main)] block">Clear Temporary Files</span>
            <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Wipe cached folder assets and downloads</span>
          </div>
          <button 
            onClick={async () => {
              setLoadingGlobal(true);
              try {
                const res = await window.electronAPI.settings.clearTemp();
                setStatusMsg(`Cache cleared: deleted ${res.clearedCount} temporary cache files.`);
              } catch (err) {
                console.error(err);
              } finally {
                setLoadingGlobal(false);
              }
            }}
            className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
          >
            Clear Cache
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-[var(--border-color)]/40">
          <div>
            <span className="font-semibold text-[var(--text-main)] block">Truncate Diagnostics Logs</span>
            <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Clear logging logs inside app data logs folder</span>
          </div>
          <button 
            onClick={async () => {
              setLoadingGlobal(true);
              try {
                const res = await window.electronAPI.settings.clearLogs();
                setStatusMsg(`Logs truncated: cleaned up ${res.clearedCount} log files.`);
              } catch (err) {
                console.error(err);
              } finally {
                setLoadingGlobal(false);
              }
            }}
            className="bg-[var(--bg-panel-header)] hover:bg-[var(--bg-panel-header)]/80 text-[var(--text-main)] border border-[var(--border-color)] rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
          >
            Clear Logs
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border-color)]/40">
          <div>
            <span className="font-semibold text-red-500 block">Reset Application Data</span>
            <span className="text-xs text-[var(--text-subtle)] mt-0.5 block leading-normal">Permanently wipe all credentials, connections, and layout options</span>
          </div>
          <button 
            onClick={async () => {
              if (confirm('CRITICAL: This will delete your database and wipe ALL profiles. Are you sure you want to reset and exit?')) {
                await window.electronAPI.settings.resetApp();
              }
            }}
            className="bg-red-650 hover:bg-red-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer outline-none"
          >
            Reset App
          </button>
        </div>
      </div>
    </div>
  );
};
