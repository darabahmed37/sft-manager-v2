import React, { useEffect, useState } from 'react';
import { FaFile, FaFolder, FaTimes, FaUser, FaLock, FaCalendarAlt, FaHdd } from 'react-icons/fa';

interface PropertiesModalProps {
  onClose: () => void;
  pane: 'local' | 'remote';
  sessionId?: string;
  file: {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: string;
    owner?: string;
    permissions?: string;
  };
}

export const PropertiesModal: React.FC<PropertiesModalProps> = ({
  onClose,
  pane,
  sessionId,
  file,
}) => {
  const [size, setSize] = useState<number | null>(null);
  const [loadingSize, setLoadingSize] = useState<boolean>(false);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i] + ` (${bytes.toLocaleString()} bytes)`;
  };

  useEffect(() => {
    const calculateFolderSize = async () => {
      if (!file.isDirectory) {
        setSize(file.size);
        return;
      }

      setLoadingSize(true);
      try {
        let computedSize = 0;
        if (pane === 'local') {
          computedSize = await window.electronAPI.fs.calculateSize(file.path);
        } else if (pane === 'remote' && sessionId) {
          computedSize = await window.electronAPI.ssh.calculateSize(sessionId, file.path);
        }
        setSize(computedSize);
      } catch (err) {
        console.error('Failed to calculate folder size', err);
        setSize(0);
      } finally {
        setLoadingSize(false);
      }
    };

    calculateFolderSize();
  }, [file, pane, sessionId]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] text-[13px] text-[var(--text-main)] font-sans">
      <div className="w-[450px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-[8px] flex flex-col shadow-[var(--shadow-modal)] overflow-hidden">
        
        {/* Header */}
        <div className="h-[40px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-4.5 justify-between">
          <span className="font-bold text-[11.5px] uppercase tracking-wider text-[var(--text-muted)]">
            Properties — {file.name}
          </span>
          <button 
            onClick={onClose}
            className="bg-transparent border-none text-[var(--text-muted)] hover:text-white cursor-pointer outline-none flex items-center"
          >
            <FaTimes size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[480px]">
          
          {/* Main Info Row */}
          <div className="flex gap-4 items-start pb-4 border-b border-[var(--border-color)]/50">
            <div className="p-3 bg-[var(--bg-panel-header)] border border-[var(--border-color)] rounded-[6px] text-[var(--color-primary)] shrink-0">
              {file.isDirectory ? <FaFolder size={28} /> : <FaFile size={28} />}
            </div>
            <div className="flex-1 overflow-hidden">
              <span className="font-bold text-[14px] text-[var(--text-main)] block truncate" title={file.name}>
                {file.name}
              </span>
              <span className="text-xs text-[var(--text-subtle)] mt-1.5 block">
                Type: {file.isDirectory ? 'File Folder' : 'Document File'} ({pane === 'local' ? 'Local File System' : 'Remote SFTP'})
              </span>
            </div>
          </div>

          {/* Details Table */}
          <div className="flex flex-col gap-3 text-xs leading-relaxed">
            
            <div className="flex items-start">
              <span className="w-28 text-[var(--text-muted)] font-semibold shrink-0">Location:</span>
              <span className="flex-1 font-mono break-all select-all text-[var(--text-subtle)]" title={file.path}>
                {file.path}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-28 text-[var(--text-muted)] font-semibold shrink-0">
                <FaHdd className="inline mr-1 text-[11px]" /> Size:
              </span>
              <span className="flex-1 font-mono text-[var(--text-main)]">
                {loadingSize ? (
                  <span className="italic text-[var(--text-muted)] animate-pulse">Calculating folder size...</span>
                ) : size !== null ? (
                  formatSize(size)
                ) : (
                  '--'
                )}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-28 text-[var(--text-muted)] font-semibold shrink-0">
                <FaCalendarAlt className="inline mr-1 text-[11px]" /> Modified:
              </span>
              <span className="flex-1 font-mono text-[var(--text-subtle)]">
                {file.modified}
              </span>
            </div>

            {pane === 'remote' && (
              <>
                <div className="flex items-center">
                  <span className="w-28 text-[var(--text-muted)] font-semibold shrink-0">
                    <FaUser className="inline mr-1 text-[11px]" /> Owner / Group:
                  </span>
                  <span className="flex-1 font-mono text-[var(--text-subtle)]">
                    {file.owner || '--'}
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="w-28 text-[var(--text-muted)] font-semibold shrink-0">
                    <FaLock className="inline mr-1 text-[11px]" /> Permissions:
                  </span>
                  <span className="flex-1 font-mono text-[var(--text-subtle)]">
                    {file.permissions || '--'}
                  </span>
                </div>
              </>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="h-[48px] bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-4 justify-end">
          <button 
            onClick={onClose}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-none rounded-[5px] px-6 py-2 text-[12.5px] font-semibold cursor-pointer outline-none transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
