import React, { useState, useEffect, useRef } from 'react';
import type { LocalFile, RemoteFile } from '../global';

interface ExplorerTableProps {
  pane: 'local' | 'remote';
  files: (LocalFile | RemoteFile)[];
  selectedFile: LocalFile | RemoteFile | null;
  selectedFiles: (LocalFile | RemoteFile)[];
  onSelect: (file: LocalFile | RemoteFile) => void;
  onMultiSelectChange: (files: (LocalFile | RemoteFile)[]) => void;
  onDoubleClick: (file: LocalFile | RemoteFile) => void;
  onContextMenu: (e: React.MouseEvent, file: LocalFile | RemoteFile) => void;
  onEmptyContextMenu: (e: React.MouseEvent) => void;
  sortField: string;
  sortAsc: boolean;
  onSort: (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => void;
  colWidths: {
    name: number;
    size: number;
    modified: number;
    owner?: number;
  };
  onResizeStart: (e: React.MouseEvent, column: string, currentWidth: number) => void;
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

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  pane,
  files,
  selectedFile,
  selectedFiles,
  onSelect,
  onMultiSelectChange,
  onDoubleClick,
  onContextMenu,
  onEmptyContextMenu,
  sortField,
  sortAsc,
  onSort,
  colWidths,
  onResizeStart,
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
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
  const [lassoBox, setLassoBox] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  // Always-on document listeners; they are no-ops while lassoStartRef is null.
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

      // Only do selection if the lasso is large enough to be intentional
      if (right - left < 5 && bottom - top < 5) return;

      const selected: (LocalFile | RemoteFile)[] = [];
      rowRefs.current.forEach((rowEl, idx) => {
        if (!rowEl || idx >= files.length) return;
        const r = rowEl.getBoundingClientRect();
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
    // Don't start lasso when clicking on a row or header cell
    if (target.closest('tr[data-file-row]') || target.closest('th')) return;
    lassoStartRef.current = { x: e.clientX, y: e.clientY };
    onMultiSelectChange([]);
    onEmptySpaceClick();
  };
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Lasso overlay — fixed so coords are in viewport space */}
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
        className="flex-1 overflow-auto h-full pr-4"
        onMouseDown={handleContainerMouseDown}
        onContextMenu={(e) => {
          // Bubble check: only call blank handler when NOT on a file row
          if (!(e.target as HTMLElement).closest('tr[data-file-row]')) {
            onEmptyContextMenu(e);
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onEmptySpaceClick();
        }}
      >
        <table className="w-full border-collapse text-[13px] table-fixed">
          <colgroup>
            <col style={{ width: '26px' }} />
            <col style={{ width: `${colWidths.name}px` }} />
            <col style={{ width: `${colWidths.size}px` }} />
            <col style={{ width: `${colWidths.modified}px` }} />
            {pane === 'remote' && (
              <col style={{ width: `${colWidths.owner ?? 80}px` }} />
            )}
          </colgroup>
          <thead className="sticky top-0 bg-[var(--bg-panel-header)] z-10 border-b border-[var(--border-color)]">
            <tr className="h-[28px] text-[12px] text-[var(--text-muted)] border-b border-[var(--border-color)]">
              <th className="py-1 pl-2 text-left border-r border-[var(--border-color)]/30" />
              <th
                onClick={() => onSort('name')}
                className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30"
              >
                Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'name', colWidths.name)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10"
                />
              </th>
              <th
                onClick={() => onSort('size')}
                className="relative text-right px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30"
              >
                Size {sortField === 'size' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'size', colWidths.size)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10"
                />
              </th>
              <th
                onClick={() => onSort('modified')}
                className={`relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)] ${pane === 'remote' ? 'border-r border-[var(--border-color)]/30' : ''}`}
              >
                Modified {sortField === 'modified' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'modified', colWidths.modified)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10"
                />
              </th>
              {pane === 'remote' && (
                <th
                  onClick={() => onSort('owner')}
                  className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                >
                  Owner {sortField === 'owner' ? (sortAsc ? '▲' : '▼') : ''}
                  <div
                    onMouseDown={(e) => onResizeStart(e, 'owner', colWidths.owner ?? 80)}
                    className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10"
                  />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {files.map((file, i) => {
              const targetPath    = joinPath(currentDir, file.name);
              const isSelected    = selectedFile?.name === file.name;
              const isMultiSel    = selectedFiles.some(f => f.name === file.name);
              const isDragOver    = dragOverRow === targetPath;
              const isCut         = clipboard?.type === 'cut' &&
                                    clipboard.items.some(ci => ci.name === file.name);

              return (
                <tr
                  key={i}
                  data-file-row="true"
                  ref={el => { rowRefs.current[i] = el; }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.ctrlKey || e.metaKey) {
                      // Toggle Ctrl+click multi-select
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
                    isMultiSel
                      ? 'bg-[var(--color-primary)]/25 text-[var(--active-tab-text)] font-semibold'
                      : isSelected
                        ? 'bg-[var(--glow-color)]/30 text-[var(--active-tab-text)] font-semibold'
                        : 'hover:bg-[var(--glow-color)]/25',
                    isDragOver ? 'bg-[var(--color-primary)]/20 border-y border-dashed border-[var(--color-primary)]' : '',
                    isCut ? 'opacity-40' : '',
                    'cursor-default h-[30px] transition-colors duration-75 border-b border-[var(--border-color)]/50',
                  ].join(' ')}
                >
                  {/* Icon col — same for both panes, no checkboxes */}
                  <td className="pl-1.5 text-center align-middle">
                    {file.isDirectory ? (
                      <svg width="14" height="12" viewBox="0 0 16 14" fill="none">
                        <path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85" />
                      </svg>
                    ) : (
                      <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                        <path d="M0 0h8l4 4v10H0z" fill="currentColor" opacity="0.55" />
                        <path d="M8 0l4 4H8z" fill="currentColor" opacity="0.35" />
                      </svg>
                    )}
                  </td>

                  {/* Name */}
                  <td
                    className="px-2 text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap align-middle"
                    title={file.name}
                  >
                    {file.name}
                  </td>

                  {/* Size */}
                  <td className="px-2 text-right text-[var(--text-muted)] font-mono text-[12px] align-middle whitespace-nowrap">
                    {formatSize(file.size)}
                  </td>

                  {/* Modified */}
                  <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">
                    {getModifiedStr(file)}
                  </td>

                  {/* Owner (remote only) */}
                  {pane === 'remote' && (
                    <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">
                      {(file as RemoteFile).owner}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Spacer — always ensures there is empty space below the last row
            so users can right-click to get the blank context menu */}
        <div className="h-[150px]" />
      </div>
    </>
  );
};
