import React from 'react';
import type { LocalFile, RemoteFile } from '../global';

interface ExplorerTableProps {
  pane: 'local' | 'remote';
  files: (LocalFile | RemoteFile)[];
  selectedFile: LocalFile | RemoteFile | null;
  onSelect: (file: LocalFile | RemoteFile) => void;
  onDoubleClick: (file: LocalFile | RemoteFile) => void;
  onContextMenu: (e: React.MouseEvent, file: LocalFile | RemoteFile) => void;
  sortField: string;
  sortAsc: boolean;
  onSort: (field: 'name' | 'size' | 'modified' | 'owner' | 'permissions') => void;
  colWidths: {
    name: number;
    size: number;
    modified: number;
    owner?: number;
    perms?: number;
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
}

export const ExplorerTable: React.FC<ExplorerTableProps> = ({
  pane,
  files,
  selectedFile,
  onSelect,
  onDoubleClick,
  onContextMenu,
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
}) => {
  const getModifiedStr = (file: LocalFile | RemoteFile): string => {
    return 'modified' in file ? file.modified : (file as RemoteFile).date;
  };

  return (
    <div 
      className="flex-1 overflow-auto h-full pr-4" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onEmptySpaceClick();
        }
      }}
    >
      <table className="w-full border-collapse text-[13px] table-fixed">
        <colgroup>
          <col style={{ width: '26px' }} />
          <col style={{ width: `${colWidths.name}px` }} />
          <col style={{ width: `${colWidths.size}px` }} />
          <col style={{ width: `${colWidths.modified}px` }} />
          {pane === 'remote' && (
            <>
              <col style={{ width: `${colWidths.owner ?? 80}px` }} />
              <col style={{ width: `${colWidths.perms ?? 80}px` }} />
            </>
          )}
        </colgroup>
        <thead className="sticky top-0 bg-[var(--bg-panel-header)] z-10 border-b border-[var(--border-color)]">
          <tr className="h-[28px] text-[12px] text-[var(--text-muted)] border-b border-[var(--border-color)]">
            <th className="py-1 pl-2 text-left border-r border-[var(--border-color)]/30">
              {pane === 'remote' && (
                <input type="checkbox" className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer" readOnly />
              )}
            </th>
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
              className={`relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)] ${pane === 'local' ? '' : 'border-r border-[var(--border-color)]/30'}`}
            >
              Modified {sortField === 'modified' ? (sortAsc ? '▲' : '▼') : ''}
              <div 
                onMouseDown={(e) => onResizeStart(e, 'modified', colWidths.modified)} 
                className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
              />
            </th>
            {pane === 'remote' && (
              <>
                <th 
                  onClick={() => onSort('owner')}
                  className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)] border-r border-[var(--border-color)]/30"
                >
                  Owner {sortField === 'owner' ? (sortAsc ? '▲' : '▼') : ''}
                  <div 
                    onMouseDown={(e) => onResizeStart(e, 'owner', colWidths.owner ?? 80)} 
                    className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                  />
                </th>
                <th 
                  onClick={() => onSort('permissions')}
                  className="relative text-left px-2 font-semibold tracking-wider select-none cursor-pointer hover:text-[var(--text-main)]"
                >
                  Perms {sortField === 'permissions' ? (sortAsc ? '▲' : '▼') : ''}
                  <div 
                    onMouseDown={(e) => onResizeStart(e, 'perms', colWidths.perms ?? 80)} 
                    className="absolute right-0 top-1 bottom-1 w-[1px] bg-[var(--border-color)]/45 cursor-col-resize hover:bg-[var(--color-primary)] z-10" 
                  />
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {files.map((file, i) => {
            const targetPath = joinPath(currentDir, file.name);
            const isSelected = selectedFile?.name === file.name;
            const isDragOver = dragOverRow === targetPath;

            return (
              <tr 
                key={i} 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(file);
                }}
                onDoubleClick={() => onDoubleClick(file)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  onSelect(file);
                  onContextMenu(e, file);
                }}
                draggable={true}
                onDragStart={(e) => onDragStart(e, file)}
                onDragEnter={(e) => {
                  e.stopPropagation();
                  if (file.isDirectory) {
                    onDragEnter(e, file);
                  }
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  onDragLeave(e);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (file.isDirectory) {
                    onDrop(e, targetPath);
                  } else {
                    onDrop(e);
                  }
                }}
                className={`${isSelected ? 'bg-[var(--glow-color)]/30 text-[var(--active-tab-text)] font-semibold' : 'hover:bg-[var(--glow-color)]/25'} ${isDragOver ? 'bg-[var(--color-primary)]/20 border-y border-dashed border-[var(--color-primary)]' : ''} cursor-default h-[30px] transition-colors duration-75 border-b border-[var(--border-color)]/50`}
              >
                <td className="pl-1.5 text-center align-middle">
                  {pane === 'remote' ? (
                    <input 
                      type="checkbox" 
                      onChange={() => {}}
                      className="w-[11px] h-[11px] accent-[var(--color-primary)] cursor-pointer"
                      checked={isSelected}
                      readOnly
                    />
                  ) : file.isDirectory ? (
                    <svg width="14" height="12" viewBox="0 0 16 14" fill="none"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                  ) : (
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="none"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                  )}
                </td>
                <td className="px-2 text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap align-middle" title={file.name}>
                  {pane === 'remote' ? (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {file.isDirectory ? (
                        <svg width="14" height="12" viewBox="0 0 16 14" fill="none" className="shrink-0"><path d="M0 2.5h7l1.5 2H16v9H0z" fill="var(--color-primary)" opacity="0.85"/></svg>
                      ) : (
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" className="shrink-0"><path d="M0 0h8l4 4v10H0z" fill="currentColor" className="text-[var(--text-muted)]" opacity="0.6"/><path d="M8 0l4 4H8z" fill="currentColor" className="text-[var(--text-subtle)]"/></svg>
                      )}
                      <span className="text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap" title={file.name}>{file.name}</span>
                    </div>
                  ) : (
                    file.name
                  )}
                </td>
                <td className="px-2 text-right text-[var(--text-muted)] font-mono text-[12px] align-middle whitespace-nowrap">{formatSize(file.size)}</td>
                <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{getModifiedStr(file)}</td>
                {pane === 'remote' && (
                  <>
                    <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{(file as RemoteFile).owner}</td>
                    <td className="px-2 text-[var(--text-subtle)] font-mono text-[12px] align-middle whitespace-nowrap">{(file as RemoteFile).permissions}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
