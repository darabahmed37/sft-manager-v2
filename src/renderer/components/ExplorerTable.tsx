import React, { useState, useEffect, useRef } from 'react';
import type { LocalFile, RemoteFile } from '../global';

interface ExplorerTableProps {
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
  loading,
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

      // Real-time hit-test against actual file rows only
      const selected: (LocalFile | RemoteFile)[] = [];
      rowRefs.current.forEach((rowEl, idx) => {
        if (!rowEl || idx >= files.length) return;
        const r = rowEl.getBoundingClientRect();
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
    if (target.closest('tr[data-file-row]') || target.closest('th')) return;
    lassoStartRef.current = { x: e.clientX, y: e.clientY };
    onMultiSelectChange([]);
    onEmptySpaceClick();
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Number of defined columns (icon + data cols + filler)
  const colSpanAll = pane === 'remote' ? 6 : 5;

  return (
    <>
      {/* Lasso overlay — fixed viewport coords */}
      {lassoBox && lassoBox.width > 4 && lassoBox.height > 4 && (
        <div
          style={{
            position: 'fixed',
            left:   lassoBox.left,
            top:    lassoBox.top,
            width:  lassoBox.width,
            height: lassoBox.height,
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
        className="flex-1 overflow-auto h-full"
        onMouseDown={handleContainerMouseDown}
        onContextMenu={(e) => {
          if (!(e.target as HTMLElement).closest('tr[data-file-row]')) {
            e.stopPropagation();
            onEmptyContextMenu(e);
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onEmptySpaceClick();
        }}
      >
        {/*
          w-full + table-fixed: columns respect colgroup widths exactly,
          which is what makes the resize handles work.
        */}
        <table className="w-full border-collapse text-[13px] table-fixed">
          <colgroup>
            <col style={{ width: '30px' }} />
            <col style={{ width: `${colWidths.name}px` }} />
            <col style={{ width: `${colWidths.size}px` }} />
            <col style={{ width: `${colWidths.modified}px` }} />
            {pane === 'remote' && (
              <col style={{ width: `${colWidths.owner ?? 80}px` }} />
            )}
            {/* Filler column — takes remaining width, right-click → blank menu */}
            <col />
          </colgroup>

          <thead className="sticky top-0 bg-[var(--bg-panel-header)] z-10 border-b border-[var(--border-color)]">
            <tr className="h-[42px] text-[12px] text-[var(--text-muted)] border-b border-[var(--border-color)]">

              {/* Icon col — no header text */}
              <th className="py-1 pl-2 border-r border-[var(--border-color)]/30" />

              <th
                onClick={() => onSort('name')}
                className="relative text-left px-3 font-semibold select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30 uppercase text-[12px]"
              >
                Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'name', colWidths.name)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] hover:w-[2px] z-10"
                />
              </th>

              <th
                onClick={() => onSort('size')}
                className="relative text-right px-3 font-semibold select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30 uppercase text-[12px]"
              >
                Size {sortField === 'size' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'size', colWidths.size)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] hover:w-[2px] z-10"
                />
              </th>

              <th
                onClick={() => onSort('modified')}
                className={`relative text-left px-3 font-semibold select-none cursor-pointer hover:text-[var(--text-main)] uppercase text-[12px] ${pane === 'remote' ? 'border-r border-[var(--border-color)]/30' : ''}`}
              >
                Modified {sortField === 'modified' ? (sortAsc ? '▲' : '▼') : ''}
                <div
                  onMouseDown={(e) => onResizeStart(e, 'modified', colWidths.modified)}
                  className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] hover:w-[2px] z-10"
                />
              </th>

              {pane === 'remote' && (
                <th
                  onClick={() => onSort('owner')}
                  className="relative text-left px-3 font-semibold select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30 uppercase text-[12px]"
                >
                  Owner {sortField === 'owner' ? (sortAsc ? '▲' : '▼') : ''}
                  <div
                    onMouseDown={(e) => onResizeStart(e, 'owner', colWidths.owner ?? 80)}
                    className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] hover:w-[2px] z-10"
                  />
                </th>
              )}

              {/* Filler header — right-click → blank menu */}
              <th
                onContextMenu={(e) => { e.stopPropagation(); onEmptyContextMenu(e); }}
              />
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <tr 
                  key={`skeleton-${i}`} 
                  className="h-[42px] border-b border-[var(--border-color)]/20 hover:bg-transparent"
                >
                  {/* Icon */}
                  <td className="py-1.5 pl-2 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-[4px] skeleton-placeholder" />
                  </td>

                  {/* Name */}
                  <td className="px-3 truncate">
                    <div 
                      className="h-3.5 rounded-[4px] skeleton-placeholder" 
                      style={{ width: `${Math.max(80, Math.min(colWidths.name - 40, (120 + (i % 3) * 30)))}px` }}
                    />
                  </td>

                  {/* Size */}
                  <td className="px-3 text-right">
                    {!i || i % 3 === 0 ? (
                      <div className="h-3.5 w-10 rounded-[4px] skeleton-placeholder ml-auto" />
                    ) : (
                      <div className="text-[var(--text-subtle)] opacity-40">-</div>
                    )}
                  </td>

                  {/* Modified */}
                  <td className="px-3 text-left">
                    <div className="h-3.5 w-20 rounded-[4px] skeleton-placeholder" />
                  </td>

                  {/* Owner */}
                  {pane === 'remote' && (
                    <td className="px-3 text-left">
                      <div className="h-3.5 w-14 rounded-[4px] skeleton-placeholder" />
                    </td>
                  )}

                  {/* Filler */}
                  <td />
                </tr>
              ))
            ) : files.flatMap((file, i) => {
              const targetPath = joinPath(currentDir, file.name);
              const isSelected = selectedFile?.name === file.name;
              const isMultiSel = selectedFiles.some(f => f.name === file.name);
              const isDragOver = dragOverRow === targetPath;
              const isCut      = clipboard?.type === 'cut' &&
                                 clipboard.items.some(ci => ci.name === file.name);

              const rowBg = isMultiSel
                ? 'bg-[var(--color-primary)]/25 text-[var(--active-tab-text)] font-semibold'
                : isSelected
                  ? 'bg-[var(--glow-color)]/30 text-[var(--active-tab-text)] font-semibold'
                  : 'hover:bg-[var(--glow-color)]/20';

              const fileRow = (
                <tr
                  key={`file-${i}`}
                  data-file-row="true"
                  ref={el => { rowRefs.current[i] = el; }}
                  onDoubleClick={() => onDoubleClick(file)}
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
                    rowBg,
                    isDragOver ? 'bg-[var(--color-primary)]/20 border-y border-dashed border-[var(--color-primary)]' : '',
                    isCut ? 'opacity-40' : '',
                    'cursor-default h-[42px] transition-colors duration-75',
                  ].join(' ')}
                >
                  {/* Icon */}
                  <td
                    className={`pl-2 pr-1 text-center align-middle py-1 ${isMultiSel || isSelected ? 'border-l-2 border-l-[var(--color-primary)]' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onSelect(file); onMultiSelectChange([]); }}
                    onContextMenu={(e) => { e.stopPropagation(); onSelect(file); onContextMenu(e, file); }}
                  >
                    {file.isDirectory ? (
                      <svg className="mx-auto" width="18" height="15" viewBox="0 0 18 16" fill="none">
                        <path d="M1.5 3a1.5 1.5 0 0 1 1.5-1.5h3.586a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H15a1.5 1.5 0 0 1 1.5 1.5v1.5H1.5V3z" fill="var(--color-primary)" opacity="0.75" />
                        <path d="M1.5 5.5C1.5 4.67 2.17 4 3 4h12c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5H3c-.83 0-1.5-.67-1.5-1.5v-7z" fill="var(--color-primary)" />
                      </svg>
                    ) : (
                      <svg className="mx-auto" width="13" height="15" viewBox="0 0 14 16" fill="none">
                        <path d="M2 1a1 1 0 0 1 1-1h6.586a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1z" fill="var(--bg-panel)" stroke="var(--text-subtle)" strokeWidth="1.2" />
                        <path d="M9 0v3.5a.5.5 0 0 0 .5.5H13" fill="var(--bg-panel-header)" stroke="var(--text-subtle)" strokeWidth="1.2" />
                      </svg>
                    )}
                  </td>

                  {/* Name */}
                  <td
                    className="px-3 text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap align-middle py-1"
                    title={file.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.ctrlKey || e.metaKey) {
                        const already = selectedFiles.some(f => f.name === file.name);
                        onMultiSelectChange(already
                          ? selectedFiles.filter(f => f.name !== file.name)
                          : [...selectedFiles, file]);
                      } else {
                        onSelect(file);
                        onMultiSelectChange([]);
                      }
                    }}
                    onContextMenu={(e) => { e.stopPropagation(); onSelect(file); onContextMenu(e, file); }}
                  >
                    {file.name}
                  </td>

                  {/* Size */}
                  <td
                    className="px-3 text-right text-[var(--text-muted)] font-mono text-[12px] align-middle whitespace-nowrap tabular-nums py-1"
                    onClick={(e) => { e.stopPropagation(); onSelect(file); onMultiSelectChange([]); }}
                    onContextMenu={(e) => { e.stopPropagation(); onSelect(file); onContextMenu(e, file); }}
                  >
                    {formatSize(file.size)}
                  </td>

                  {/* Modified */}
                  <td
                    className="px-3 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap tabular-nums py-1"
                    onClick={(e) => { e.stopPropagation(); onSelect(file); onMultiSelectChange([]); }}
                    onContextMenu={(e) => { e.stopPropagation(); onSelect(file); onContextMenu(e, file); }}
                  >
                    {getModifiedStr(file)}
                  </td>

                  {/* Owner (remote only) */}
                  {pane === 'remote' && (
                    <td
                      className="px-3 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap py-1"
                      onClick={(e) => { e.stopPropagation(); onSelect(file); onMultiSelectChange([]); }}
                      onContextMenu={(e) => { e.stopPropagation(); onSelect(file); onContextMenu(e, file); }}
                    >
                      {(file as RemoteFile).owner}
                    </td>
                  )}

                  {/*
                    Filler cell — fills remaining row width.
                    Left-click → select; Right-click → blank context menu.
                  */}
                  <td
                    onClick={(e) => { e.stopPropagation(); onSelect(file); onMultiSelectChange([]); }}
                    onContextMenu={(e) => { e.stopPropagation(); onEmptyContextMenu(e); }}
                    className="py-1"
                  />
                </tr>
              );

              // Thin spacer row after every file/folder row — right-click shows blank menu
              const spacerRow = (
                <tr
                  key={`spacer-${i}`}
                  className="h-[4px]"
                  onContextMenu={(e) => { e.stopPropagation(); onEmptyContextMenu(e); }}
                >
                  <td colSpan={colSpanAll} />
                </tr>
              );

              return [fileRow, spacerRow];
            })}

            {/* Extra blank rows at the bottom for easy empty-space right-clicking */}
            {Array.from({ length: 4 }).map((_, i) => (
              <tr
                key={`ghost-${i}`}
                className="h-[42px]"
                onContextMenu={(e) => { e.stopPropagation(); onEmptyContextMenu(e); }}
              >
                <td colSpan={colSpanAll} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
