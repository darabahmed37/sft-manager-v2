import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaTrash } from 'react-icons/fa';
import type { KnownHost } from '../../global';

interface KnownHostsTabProps {
  setLoadingGlobal: (val: boolean) => void;
}

export const KnownHostsTab: React.FC<KnownHostsTabProps> = ({ setLoadingGlobal }) => {
  const [knownHosts, setKnownHosts] = useState<KnownHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<KnownHost | null>(null);

  const loadKnownHosts = React.useCallback(async () => {
    try {
      Promise.resolve().then(() => setLoadingGlobal(true));
      const hosts = await window.electronAPI.settings.getKnownHosts();
      setKnownHosts(hosts);
    } catch (err) {
      console.error('Failed to load known hosts', err);
    } finally {
      setLoadingGlobal(false);
    }
  }, [setLoadingGlobal]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadKnownHosts();
    });
  }, [loadKnownHosts]);

  const handleDeleteHost = async (id: number, hostStr: string) => {
    if (confirm(`Remove trusted SSH host key fingerprint for "${hostStr}"?`)) {
      setLoadingGlobal(true);
      try {
        await window.electronAPI.settings.deleteKnownHost(id);
        await loadKnownHosts();
        setSelectedHost(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? (err as Error).message : String(err);
        alert(msg);
      } finally {
        setLoadingGlobal(false);
      }
    }
  };

  return (
    <div className="flex-1 flex gap-4 overflow-hidden h-full">
      {!selectedHost ? (
        <div className="flex-1 flex flex-col bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] overflow-hidden">
          <div className="h-[30px] bg-[var(--bg-panel-header)] px-2.5 border-b border-[var(--border-color)] flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Trusted Hosts</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1">
            {knownHosts.length > 0 ? (
              knownHosts.map((kh) => (
                <div 
                  key={kh.id}
                  onClick={() => setSelectedHost(kh)}
                  className="px-2.5 py-2.5 bg-[var(--bg-panel)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-[3px] flex items-center justify-between cursor-pointer transition-all"
                >
                  <span className="font-medium text-[var(--text-main)]">{kh.host}:{kh.port}</span>
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded-[2px] bg-[var(--bg-panel-header)] text-[var(--text-subtle)] border border-[var(--border-color)]">
                    {kh.keyType}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--text-subtle)] font-medium py-20 text-center">
                No trusted host fingerprinted entries.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-[3px] p-4.5 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2 mb-2">
            <button 
              onClick={() => setSelectedHost(null)}
              className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none flex items-center"
            >
              <FaArrowLeft size={12} />
            </button>
            <span className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)]">Host Fingerprint Details</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-1">
            <span className="text-[var(--text-muted)] font-semibold">Host / Host IP:</span>
            <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.host}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-1">
            <span className="text-[var(--text-muted)] font-semibold">Port Number:</span>
            <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.port}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-1">
            <span className="text-[var(--text-muted)] font-semibold">Key Algorithm:</span>
            <span className="col-span-2 text-[var(--text-main)] font-mono">{selectedHost.keyType}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 py-1">
            <span className="text-[var(--text-muted)] font-semibold">SHA-256 Fingerprint:</span>
            <span className="col-span-2 text-[var(--text-main)] font-mono whitespace-pre-wrap select-text">{selectedHost.fingerprint}</span>
          </div>

          <div className="flex gap-2 justify-end mt-4 border-t border-[var(--border-color)] pt-3">
            <button 
              onClick={() => handleDeleteHost(selectedHost.id, selectedHost.host)}
              className="bg-red-650 hover:bg-red-700 text-white border-none rounded-[3px] px-4 py-1.5 text-xs font-semibold cursor-pointer flex items-center gap-1.5 select-none transition-all outline-none"
            >
              <FaTrash size={11} /> Remove Trust
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
