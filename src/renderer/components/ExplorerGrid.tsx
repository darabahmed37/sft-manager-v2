import React, { useState, useEffect, useRef } from 'react';
import type { LocalFile, RemoteFile } from '../global';

interface ExplorerGridProps {
  pane: 'local' | 'remote';
  files: (LocalFile | RemoteFile)[];
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
  const [lassoBox, setLassoBox] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const s = lassoStartRef.current;
      setLassoBox({
        left:   Math.min(s.x, e.clientX),
        top:    Math.min(s.y, e.clientY),
        width:  Math.abs(e.clientX - s.x),
        height: Math.abs(e.clientY - s.y),
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!lassoStartRef.current) return;
      const s = lassoStartRef.current;
      const left   = Math.min(s.x, e.clientX);
      const right  = Math.max(s.x, e.clientX);
      const top    = Math.min(s.y, e.clientY);
      const bottom = Math.max(s.y, e.clientY);

      lassoStartRef.current = null;
      setLassoBox(null);

      if (right - left < 5 && bottom - top < 5) return;

      const selected: (LocalFile | RemoteFile)[] = [];
      itemRefs.current.forEach((el, idx) => {
        if (!el || idx >= files.length) return;
        const r = el.getBoundingClientRect();
        if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
          selected.push(files[idx]);
        }
      });
      if (selected.length > 0) onMultiSelectChange(selected);
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
        className={`p-${pane === 'local' ? '1.5' : '2'} flex flex-wrap gap-0.5 content-start items-start h-full overflow-auto pr-4`}
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
        {files.map((file, i) => {
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
                'flex flex-col items-center gap-1 cursor-default border rounded-[2px]',
                pane === 'local'
                  ? `w-20 p-1.5 ${isMultiSel || isSelected ? 'bg-[var(--glow-color)]/40 border-[var(--color-primary)]' : 'border-transparent hover:bg-[var(--glow-color)]/20'}`
                  : `w-[88px] p-2 ${isMultiSel || isSelected ? 'bg-[var(--glow-color)]/40 border-[var(--color-primary)]' : 'border-transparent hover:bg-[var(--glow-color)]/20'}`,
                isDragOver ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)] border-dashed' : '',
                isCut ? 'opacity-40' : '',
              ].join(' ')}
            >
              {pane === 'local' ? (
                file.isDirectory ? (
                  <svg width="40" height="34" viewBox="0 0 44 38" fill="none">
                    <path d="M0 6h20l4 5H44v27H0z" fill="var(--color-primary)" opacity="0.85"/>
                    <path d="M0 6h20l4 5H44v4H0z" fill="white" opacity="0.15"/>
                  </svg>
                ) : (
                  <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
                    <path d="M0 0h22l10 10v30H0z" fill="currentColor" opacity="0.55"/>
                    <path d="M22 0l10 10H22z" fill="currentColor" opacity="0.35"/>
                  </svg>
                )
              ) : (
                file.isDirectory ? (
                  <svg width="48" height="40" viewBox="0 0 52 44" fill="none">
                    <path d="M0 8h22l5 6H52v30H0z" fill="var(--color-primary)" opacity="0.9"/>
                    <path d="M0 8h22l5 6H52v5H0z" fill="white" opacity="0.15"/>
                  </svg>
                ) : (
                  <svg width="38" height="48" viewBox="0 0 38 48" fill="none">
                    <path d="M0 0h26l12 12v36H0z" fill="currentColor" opacity="0.55"/>
                    <path d="M26 0l12 12H26z" fill="currentColor" opacity="0.35"/>
                    <line x1="7" y1="20" x2="31" y2="20" stroke="var(--border-color)" strokeWidth="2"/>
                    <line x1="7" y1="26" x2="28" y2="26" stroke="var(--border-color)" strokeWidth="2"/>
                    <line x1="7" y1="32" x2="24" y2="32" stroke="var(--border-color)" strokeWidth="2"/>
                  </svg>
                )
              )}
              <div className={`text-center overflow-hidden text-ellipsis whitespace-nowrap w-full block leading-normal ${pane === 'local' ? 'text-[10px] text-[var(--text-main)]' : 'text-[11px] text-[var(--text-main)]'}`}>
                {file.name}
              </div>
              <div className="text-center text-[10px] text-[var(--text-muted)]">
                {formatSize(file.size) || (pane === 'local' ? '' : '--')}
              </div>
              {pane === 'remote' && (
                <div className="text-[9px] text-[var(--text-subtle)] text-center font-mono">
                  {getModifiedStr(file)}
                </div>
              )}
            </div>
          );
        })}
        {/* Spacer for empty-space right-click */}
        <div className="w-full h-[120px] flex-none" />
      </div>
    </>
  );
};
