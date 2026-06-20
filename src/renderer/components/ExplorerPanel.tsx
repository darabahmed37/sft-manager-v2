import React, { useState } from 'react';
import { FaCloudUploadAlt, FaCloudDownloadAlt } from 'react-icons/fa';
import { ExplorerToolbar } from './ExplorerToolbar';
import { ExplorerTable } from './ExplorerTable';
import { ExplorerGrid } from './ExplorerGrid';
import type { LocalFile, RemoteFile, Bookmark } from '../global';

interface ExplorerPanelProps {
  pane: 'local' | 'remote';
  loading: boolean;
  currentDir: string;
  files: (LocalFile | RemoteFile)[];
  selectedFile: LocalFile | RemoteFile | null;
  onSelect: (file: LocalFile | RemoteFile | null) => void;
  onDoubleClick: (file: LocalFile | RemoteFile) => void;
  onContextMenu: (e: React.MouseEvent, file: LocalFile | RemoteFile) => void;
  onBlankContextMenu: (e: React.MouseEvent) => void;
  onEmptySpaceClick: () => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
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
  onDragEnterRow: (e: React.DragEvent, file: LocalFile | RemoteFile) => void;
  onDragLeaveRow: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, folderPath?: string) => void;
  joinPath: (parent: string, child: string) => string;
  formatSize: (bytes: number) => string;

  // Navigation
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onGoHome: () => void;
  onRefresh: () => void;
  onNavigatePath: (path: string) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  onBookmarkSelect: (path: string) => void;
  onAddBookmark: () => void;
  onDeleteBookmark: (id: number) => void;
  onSetDefaultBookmark: (id: number, isDefault: boolean) => void;
  isBookmarksOpen: boolean;
  setIsBookmarksOpen: (open: boolean) => void;

  // Header/Specific Layout
  onCollapse?: () => void;
  connectionName?: string;
  username?: string;
  host?: string;
  onOpenTerminal?: () => void;

  // Tabbed navigation (Remote-only, visible when local panel is collapsed)
  localCollapsed?: boolean;
  remoteTabs?: { path: string; isPinned: boolean }[];
  activeRemoteTabIdx?: number;
  onSelectTab?: (idx: number) => void;
  onCloseTab?: (idx: number, e: React.MouseEvent) => void;
  onTabContextMenu?: (e: React.MouseEvent, idx: number) => void;
  onAddTab?: () => void;

  // Clipboard (for cut dimming)
  clipboard: {
    type: 'copy' | 'cut';
    pane: 'local' | 'remote';
    dir: string;
    items: { name: string; isDirectory: boolean }[];
  } | null;

  // Multi-select
  selectedFiles: (LocalFile | RemoteFile)[];
  onMultiSelectChange: (files: (LocalFile | RemoteFile)[]) => void;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  pane,
  loading,
  currentDir,
  files,
  selectedFile,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onBlankContextMenu,
  onEmptySpaceClick,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortAsc,
  onSort,
  colWidths,
  onResizeStart,
  dragOverRow,
  onDragStart,
  onDragEnterRow,
  onDragLeaveRow,
  onDrop,
  joinPath,
  formatSize,

  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onGoHome,
  onRefresh,
  onNavigatePath,

  bookmarks,
  onBookmarkSelect,
  onAddBookmark,
  onDeleteBookmark,
  onSetDefaultBookmark,
  isBookmarksOpen,
  setIsBookmarksOpen,

  onCollapse,
  connectionName,
  username,
  host,
  onOpenTerminal,

  localCollapsed,
  remoteTabs,
  activeRemoteTabIdx,
  onSelectTab,
  onCloseTab,
  onTabContextMenu,
  onAddTab,
  clipboard,
  selectedFiles,
  onMultiSelectChange,
}) => {
  const [dragCount, setDragCount] = useState(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/json')) {
      setDragCount((c) => c + 1);
    }
  };

  const handleDragLeave = () => {
    setDragCount((c) => Math.max(0, c - 1));
  };

  const handleDropInternal = async (e: React.DragEvent) => {
    setDragCount(0);
    onDrop(e);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Panel Label & Info Header */}
      <div className="h-[32px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-center px-2.5 gap-1.5 shrink-0 theme-transition">
        <span className="text-[11.5px] font-bold text-[var(--text-subtle)] uppercase tracking-widest flex-shrink-0">
          {pane === 'local' ? 'Local' : 'Remote'}
        </span>
        <span 
          className="text-[12px] font-mono text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap flex-1" 
          title={pane === 'local' ? currentDir : `${connectionName} — ${username}@${host}:${currentDir}`}
        >
          {pane === 'local' ? currentDir : `${connectionName} — ${username}@${host}:${currentDir}`}
        </span>
        {pane === 'local' && onCollapse && (
          <button 
            onClick={onCollapse} 
            title="Collapse" 
            className="bg-transparent border-none p-0.5 cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center shrink-0 outline-none"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="8,2 3,6 8,10"/>
            </svg>
          </button>
        )}
      </div>

      {/* Tabs (Remote specific when local panel is collapsed) */}
      {pane === 'remote' && localCollapsed && remoteTabs && activeRemoteTabIdx !== undefined && onSelectTab && onCloseTab && onTabContextMenu && onAddTab && (
        <div className="h-[30px] bg-[var(--bg-panel-header)] border-b border-[var(--border-color)] flex items-end overflow-hidden shrink-0 theme-transition select-none">
          {remoteTabs.map((tab, i) => {
            const isActive = activeRemoteTabIdx === i;
            const pathParts = tab.path.split('/').filter(Boolean);
            const folderName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '/';
            return (
              <div 
                key={i}
                onClick={() => onSelectTab(i)} 
                onContextMenu={(e) => onTabContextMenu(e, i)}
                className={`h-7 px-3.5 flex items-center gap-1.5 text-[12px] cursor-pointer border-r border-[var(--border-color)] shrink-0 border-t transition-all ${
                  isActive 
                    ? 'bg-[var(--bg-panel)] text-[var(--active-tab-text)] border-t border-t-[var(--color-primary)] font-semibold' 
                    : 'bg-transparent text-[var(--text-muted)] border-t-transparent hover:text-[var(--text-main)] hover:bg-[var(--bg-panel)]/40'
                }`}
                title={tab.path}
              >
                <span>{tab.isPinned ? '📌 ' : ''}{folderName}</span>
                <span 
                  onClick={(e) => onCloseTab(i, e)}
                  className="text-[var(--text-subtle)] hover:text-[var(--text-main)] text-[14px] font-bold ml-1 cursor-pointer"
                >
                  ×
                </span>
              </div>
            );
          })}
          <div 
            onClick={onAddTab}
            className="w-7 h-7 flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] text-[18px] shrink-0 border-b border-b-[var(--border-color)]"
            title="New Remote Tab"
          >
            +
          </div>
        </div>
      )}

      {/* Navigation Toolbar */}
      <ExplorerToolbar 
        pane={pane}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
        onGoUp={onGoUp}
        onGoHome={onGoHome}
        onRefresh={onRefresh}
        currentDir={currentDir}
        onNavigatePath={onNavigatePath}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        bookmarks={bookmarks}
        onBookmarkSelect={onBookmarkSelect}
        onAddBookmark={onAddBookmark}
        onDeleteBookmark={onDeleteBookmark}
        onSetDefaultBookmark={onSetDefaultBookmark}
        isBookmarksOpen={isBookmarksOpen}
        setIsBookmarksOpen={setIsBookmarksOpen}
        onOpenTerminal={onOpenTerminal}
      />

      {/* Panel Files List Content */}
      <div 
        className="flex-1 overflow-y-auto relative" 
        onContextMenu={onBlankContextMenu} 
        onClick={onEmptySpaceClick}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDropInternal}
      >
        {dragCount > 0 && (
          <div className="absolute inset-0 bg-[var(--bg-app)]/90 backdrop-blur-[3px] flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-primary)] m-3 rounded-[8px] z-50 pointer-events-none transition-all duration-200">
            {pane === 'local' ? (
              <>
                <FaCloudDownloadAlt className="text-[var(--color-primary)] text-4xl mb-3 animate-pulse" />
                <div className="text-[14px] font-semibold text-[var(--text-main)]">Drop files to download</div>
                <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Copying/downloading files into local folder</div>
              </>
            ) : (
              <>
                <FaCloudUploadAlt className="text-[var(--color-primary)] text-4xl mb-3 animate-pulse" />
                <div className="text-[14px] font-semibold text-[var(--text-main)]">Drop files to upload</div>
                <div className="text-[11.5px] text-[var(--text-muted)] mt-1">Uploading files into remote folder</div>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-[var(--text-muted)] select-none">
            <svg className="animate-spin h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium text-[13px]">Loading directories and files...</span>
          </div>
        ) : viewMode === 'list' ? (
          <ExplorerTable 
            pane={pane}
            files={files}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onSelect={onSelect}
            onMultiSelectChange={onMultiSelectChange}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onEmptyContextMenu={onBlankContextMenu}
            sortField={sortField}
            sortAsc={sortAsc}
            onSort={onSort}
            colWidths={colWidths}
            onResizeStart={onResizeStart}
            dragOverRow={dragOverRow}
            onDragStart={onDragStart}
            onDragEnter={onDragEnterRow}
            onDragLeave={onDragLeaveRow}
            onDrop={onDrop}
            currentDir={currentDir}
            joinPath={joinPath}
            formatSize={formatSize}
            onEmptySpaceClick={onEmptySpaceClick}
            clipboard={clipboard}
          />
        ) : (
          <ExplorerGrid 
            pane={pane}
            files={files}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onSelect={onSelect}
            onMultiSelectChange={onMultiSelectChange}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onEmptyContextMenu={onBlankContextMenu}
            dragOverRow={dragOverRow}
            onDragStart={onDragStart}
            onDragEnter={onDragEnterRow}
            onDragLeave={onDragLeaveRow}
            onDrop={onDrop}
            currentDir={currentDir}
            joinPath={joinPath}
            formatSize={formatSize}
            onEmptySpaceClick={onEmptySpaceClick}
            clipboard={clipboard}
          />
        )}
      </div>

      {/* Bottom Panel Status Bar */}
      <div className="h-6 bg-[var(--bg-panel-header)] border-t border-[var(--border-color)] flex items-center px-3 shrink-0 text-[11.5px] text-[var(--text-muted)] theme-transition">
        <span>{files.length} items · {selectedFiles.length} selected</span>
      </div>
    </div>
  );
};
