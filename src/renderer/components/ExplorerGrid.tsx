import React, { useState, useEffect, useRef } from 'react';
import type { LocalFile, RemoteFile } from '../global';

interface ExplorerGridProps {
  pane: 'local' | 'remote';
  files: (LocalFile | RemoteFile)[];
  loading: boolean;
  selectedFile: LocalFile | RemoteFile | null;
  selectedFiles: (LocalFile | RemoteFile)[];
  onSelect: (file: LocalFile | RemoteFile) => void;
  onMultiSelectChange: (files: (LocalFile | RemoteFile)[]) => void;
  onDoubleClick: (file: LocalFile | RemoteFile) => void;
  onContextMenu: (e: React.MouseEvent, file: LocalFile | RemoteFile) => void;
  onEmptyContextMenu: (e: React.MouseEvent) => void;
  dragOverRow: string | null;
  onDragStart: (e: React.DragEvent, file: LocalFile | RemoteFile) => void;
  onDragEnter: (e: React.DragEvent, file: LocalFile | RemoteFile) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, folderPath?: string) => void;
  currentDir: string;
  joinPath: (parent: string, child: string) => string;
  formatSize: (bytes: number) => string;
  onEmptySpaceClick: () => void;
  clipboard: {
    type: 'copy' | 'cut';
    pane: 'local' | 'remote';
    dir: string;
    items: { name: string; isDirectory: boolean }[];
  } | null;
}

export const ExplorerGrid: React.FC<ExplorerGridProps> = ({
  pane,
  files,
  loading,
  selectedFile,
  selectedFiles,
  onSelect,
  onMultiSelectChange,
  onDoubleClick,
  onContextMenu,
  onEmptyContextMenu,
  dragOverRow,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
  currentDir,
  joinPath,
  formatSize,
  onEmptySpaceClick,
  clipboard,
}) => {
  const getModifiedStr = (file: LocalFile | RemoteFile): string => {
    return 'modified' in file ? file.modified : (file as RemoteFile).date;
  };

  // ── Lasso selection ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  const prevSelectedRef = useRef<string>('');
  const [lassoBox, setLassoBox] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const s = lassoStartRef.current;
      const left   = Math.min(s.x, e.clientX);
      const right  = Math.max(s.x, e.clientX);
      const top    = Math.min(s.y, e.clientY);
      const bottom = Math.max(s.y, e.clientY);

      setLassoBox({ left, top, width: right - left, height: bottom - top });

      // Real-time hit-test every grid item
      const selected: (LocalFile | RemoteFile)[] = [];
      itemRefs.current.forEach((el, idx) => {
        if (!el || idx >= files.length) return;
        const r = el.getBoundingClientRect();
        if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
          selected.push(files[idx]);
        }
      });

      const key = selected.map(f => f.name).join('\0');
      if (key !== prevSelectedRef.current) {
        prevSelectedRef.current = key;
        onMultiSelectChange(selected);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const s = lassoStartRef.current;
      const dx = Math.abs(e.clientX - s.x);
      const dy = Math.abs(e.clientY - s.y);

      lassoStartRef.current = null;
      prevSelectedRef.current = '';
      setLassoBox(null);

      if (dx < 5 && dy < 5) onMultiSelectChange([]);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup',   handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleMouseUp);
    };
  }, [files, onMultiSelectChange]);

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-grid-item]')) return;
    lassoStartRef.current = { x: e.clientX, y: e.clientY };
    onMultiSelectChange([]);
    onEmptySpaceClick();
  };
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {lassoBox && lassoBox.width > 4 && lassoBox.height > 4 && (
        <div
          style={{
            position: 'fixed',
            left:     lassoBox.left,
            top:      lassoBox.top,
            width:    lassoBox.width,
            height:   lassoBox.height,
            pointerEvents: 'none',
            zIndex: 9998,
            background: 'rgba(99, 120, 255, 0.10)',
            border: '1px solid var(--color-primary)',
            borderRadius: '2px',
          }}
        />
      )}

      <div
        ref={containerRef}
        className="p-3 flex flex-wrap gap-1.5 content-start items-start h-full overflow-auto"
        onMouseDown={handleContainerMouseDown}
        onContextMenu={(e) => {
          if (!(e.target as HTMLElement).closest('[data-grid-item]')) {
            onEmptyContextMenu(e);
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onEmptySpaceClick();
        }}
      >
        {loading ? (
          Array.from({ length: 24 }).map((_, i) => {
            const isFolder = i % 2 === 0;
            return (
              <div
                key={`skeleton-${i}`}
                className={[
                  'flex flex-col items-center gap-1.5 cursor-default border border-transparent rounded-[5px]',
                  pane === 'local'
                    ? 'w-[88px] p-2.5 bg-transparent'
                    : 'w-[96px] p-3 bg-transparent',
                ].join(' ')}
              >
                {/* Icon Placeholder */}
                {isFolder ? (
                  <div className="w-[44px] h-[38px] rounded-[6px] skeleton-placeholder mb-0.5" />
                ) : (
                  <div className="w-[34px] h-[42px] rounded-[4px] skeleton-placeholder mb-0.5" />
                )}

                {/* Name Placeholder */}
                <div 
                  className="h-3 rounded-[4px] skeleton-placeholder mt-1" 
                  style={{ width: `${Math.max(45, Math.min(65, (45 + (i % 4) * 8)))}px` }}
                />

                {/* Size Placeholder */}
                {!isFolder && (
                  <div className="h-2.5 w-8 rounded-[3px] skeleton-placeholder mt-0.5" />
                )}

                {/* Modified Placeholder (Remote only) */}
                {pane === 'remote' && (
                  <div className="h-2.5 w-12 rounded-[3px] skeleton-placeholder mt-0.5 opacity-55" />
                )}
              </div>
            );
          })
        ) : files.map((file, i) => {
          const targetPath = joinPath(currentDir, file.name);
          const isSelected  = selectedFile?.name === file.name;
          const isMultiSel  = selectedFiles.some(f => f.name === file.name);
          const isDragOver  = dragOverRow === targetPath;
          const isCut       = clipboard?.type === 'cut' &&
                              clipboard.items.some(ci => ci.name === file.name);

          return (
            <div
              key={i}
              data-grid-item="true"
              ref={el => { itemRefs.current[i] = el; }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  const already = selectedFiles.some(f => f.name === file.name);
                  onMultiSelectChange(
                    already
                      ? selectedFiles.filter(f => f.name !== file.name)
                      : [...selectedFiles, file]
                  );
                } else {
                  onSelect(file);
                  onMultiSelectChange([]);
                }
              }}
              onDoubleClick={() => onDoubleClick(file)}
              onContextMenu={(e) => {
                e.stopPropagation();
                onSelect(file);
                onContextMenu(e, file);
              }}
              draggable
              onDragStart={(e) => onDragStart(e, file)}
              onDragEnter={(e) => { e.stopPropagation(); if (file.isDirectory) onDragEnter(e, file); }}
              onDragLeave={(e) => { e.stopPropagation(); onDragLeave(e); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                file.isDirectory ? onDrop(e, targetPath) : onDrop(e);
              }}
              className={[
                'flex flex-col items-center gap-1.5 cursor-default border rounded-[5px]',
                pane === 'local'
                  ? `w-[88px] p-2.5 ${isMultiSel || isSelected ? 'bg-[var(--glow-color)]/40 border-[var(--color-primary)]' : 'border-transparent hover:bg-[var(--glow-color)]/20'}`
                  : `w-[96px] p-3 ${isMultiSel || isSelected ? 'bg-[var(--glow-color)]/40 border-[var(--color-primary)]' : 'border-transparent hover:bg-[var(--glow-color)]/20'}`,
                isDragOver ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)] border-dashed' : '',
                isCut ? 'opacity-40' : '',
              ].join(' ')}
            >
              {file.isDirectory ? (
                <svg className="mx-auto transition-transform duration-100 group-hover:scale-105" width="44" height="38" viewBox="0 0 24 20" fill="none">
                  <path d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H20a2 2 0 0 1 2 2v1H2V4z" fill="var(--color-primary)" opacity="0.75" />
                  <path d="M4 5h16v6H4V5z" fill="var(--bg-panel)" opacity="0.9" />
                  <path d="M2 6.5C2 5.67 2.67 5 3.5 5h17c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5h-17C2.67 18 2 17.33 2 16.5v-10z" fill="var(--color-primary)" />
                  <path d="M3.5 6h17c.28 0 .5.22.5.5s-.22.5-.5.5h-17a.5.5 0 0 1-.5-.5c0-.28.22-.5.5-.5z" fill="white" opacity="0.18" />
                </svg>
              ) : (
                <svg className="mx-auto" width="34" height="42" viewBox="0 0 24 28" fill="none">
                  <path d="M3 2c0-1.1.9-2 2-2h10l6 6v20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V2z" fill="var(--bg-panel)" stroke="var(--text-subtle)" strokeWidth="1.5" />
                  <path d="M15 0.5v5.5a.5.5 0 0 0 .5.5h5" fill="var(--bg-panel-header)" stroke="var(--text-subtle)" strokeWidth="1.5" strokeLinejoin="round" />
                  <line x1="7" y1="12" x2="17" y2="12" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                  <line x1="7" y1="17" x2="17" y2="17" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                  <line x1="7" y1="22" x2="13" y2="22" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                </svg>
              )}
              <div className={`text-center overflow-hidden text-ellipsis whitespace-nowrap w-full block leading-normal ${pane === 'local' ? 'text-[11.5px] text-[var(--text-main)]' : 'text-[12px] text-[var(--text-main)]'}`}>
                {file.name}
              </div>
              <div className="text-center text-[11px] text-[var(--text-muted)]">
                {formatSize(file.size) || (pane === 'local' ? '' : '--')}
              </div>
              {pane === 'remote' && (
                <div className="text-[11px] text-[var(--text-subtle)] text-center font-mono">
                  {getModifiedStr(file)}
                </div>
              )}
            </div>
          );
        })}
        {/* Spacer for empty-space right-click */}
        <div className="w-full h-[100px] flex-none" />
      </div>
    </>
  );
};
